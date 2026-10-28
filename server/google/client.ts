import { logActivity, SYSTEM_ACTOR } from '../db/activity.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import type { GoogleConnectionRow } from '../db/types.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { notify } from '../notify/index.js';
import { GoogleApiError, parseGoogleError, ReauthRequiredError } from './errors.js';
import { refreshAccessToken } from './oauth.js';

const REFRESH_MARGIN_MS = 2 * 60 * 1000;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// ---------------------------------------------------------------------------------------------
// Global throttle: token bucket shared by every Google call in this instance. The project quota
// is 300 requests/minute; each instance stays well below it.
// ---------------------------------------------------------------------------------------------
const BUCKET_CAPACITY = 10;
const REFILL_PER_MS = 150 / 60_000; // 150 requests per minute sustained
let tokens = BUCKET_CAPACITY;
let lastRefill = Date.now();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function takeToken(): Promise<void> {
  for (;;) {
    const now = Date.now();
    tokens = Math.min(BUCKET_CAPACITY, tokens + (now - lastRefill) * REFILL_PER_MS);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    await sleep(Math.ceil((1 - tokens) / REFILL_PER_MS));
  }
}

/** Marks a connection as needing reauthorization, logs it, and notifies the team (once). */
export async function markNeedsReauth(connectionId: string, reason: string): Promise<void> {
  const conn = unwrap(
    await db()
      .from('google_connections')
      .update({ status: 'needs_reauth', last_error: reason, access_token_enc: null, access_token_expires_at: null })
      .eq('id', connectionId)
      .neq('status', 'revoked')
      .select('id, email')
      .maybeSingle(),
    'Mark connection',
  );
  if (!conn) return;
  await logActivity({
    actor: SYSTEM_ACTOR,
    action: 'connection.needs_reauth',
    entityType: 'connection',
    entityId: connectionId,
    details: { email: conn.email, reason },
  });
  await notify({
    type: 'connection_needs_reauth',
    title: `${conn.email} needs reconnecting`,
    body: 'Google access expired or was revoked. Posts that use this account will fail until it is reconnected.',
    link: '/connections',
    dedupeKey: `connection_needs_reauth:${connectionId}`,
  });
}

// One in-flight refresh per connection per instance.
const refreshing = new Map<string, Promise<string>>();

export interface GoogleRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  query?: Record<string, string | number | undefined>;
  json?: unknown;
}

/** Authorized Google API client for one connection (auto-refresh, retries, throttling). */
export class GoogleClient {
  private accessToken: string | null = null;
  private expiresAt = 0;

  private constructor(private conn: GoogleConnectionRow) {
    if (conn.access_token_enc && conn.access_token_expires_at) {
      try {
        this.accessToken = decrypt(conn.access_token_enc);
        this.expiresAt = new Date(conn.access_token_expires_at).getTime();
      } catch {
        this.accessToken = null;
      }
    }
  }

  get connectionId() {
    return this.conn.id;
  }

  get email() {
    return this.conn.email;
  }

  static fromRow(conn: GoogleConnectionRow): GoogleClient {
    if (conn.status !== 'active') {
      throw new ReauthRequiredError(
        conn.id,
        conn.status === 'revoked'
          ? `${conn.email} was disconnected.`
          : `${conn.email} needs to be reconnected.`,
      );
    }
    return new GoogleClient(conn);
  }

  static async forConnection(connectionId: string): Promise<GoogleClient> {
    const conn = unwrapOne(
      await db().from('google_connections').select('*').eq('id', connectionId).maybeSingle(),
      'Google connection',
    );
    return GoogleClient.fromRow(conn);
  }

  private async refresh(): Promise<string> {
    const existing = refreshing.get(this.conn.id);
    if (existing) return existing;
    const run = (async () => {
      if (!this.conn.refresh_token_enc) {
        await markNeedsReauth(this.conn.id, 'No refresh token stored for this account.');
        throw new ReauthRequiredError(this.conn.id);
      }
      let refreshToken: string;
      try {
        refreshToken = decrypt(this.conn.refresh_token_enc);
      } catch {
        await markNeedsReauth(this.conn.id, 'Stored refresh token could not be decrypted.');
        throw new ReauthRequiredError(this.conn.id);
      }
      try {
        const token = await refreshAccessToken(refreshToken);
        const expiresAt = Date.now() + token.expires_in * 1000;
        const update: Partial<GoogleConnectionRow> = {
          access_token_enc: encrypt(token.access_token),
          access_token_expires_at: new Date(expiresAt).toISOString(),
        };
        if (token.refresh_token) update.refresh_token_enc = encrypt(token.refresh_token);
        await db().from('google_connections').update(update).eq('id', this.conn.id);
        this.accessToken = token.access_token;
        this.expiresAt = expiresAt;
        return token.access_token;
      } catch (err) {
        if (err instanceof GoogleApiError && err.reason === 'invalid_grant') {
          await markNeedsReauth(this.conn.id, err.message);
          throw new ReauthRequiredError(this.conn.id);
        }
        throw err;
      }
    })();
    refreshing.set(this.conn.id, run);
    try {
      return await run;
    } finally {
      refreshing.delete(this.conn.id);
    }
  }

  async getAccessToken(force = false): Promise<string> {
    if (!force && this.accessToken && this.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      return this.accessToken;
    }
    return this.refresh();
  }

  /** Performs an authorized request and parses JSON. Empty bodies return `{}`. */
  async request<T>(url: string, init: GoogleRequestInit = {}): Promise<T> {
    const target = new URL(url);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined && v !== '') target.searchParams.set(k, String(v));
    }
    let refreshedAfter401 = false;
    for (let attempt = 0; ; attempt++) {
      const token = await this.getAccessToken();
      await takeToken();
      let res: Response;
      try {
        res = await fetch(target, {
          method: init.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
        });
      } catch (err) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]!);
          continue;
        }
        throw new GoogleApiError(0, `Could not reach Google: ${(err as Error).message}`);
      }

      if (res.status === 401 && !refreshedAfter401) {
        refreshedAfter401 = true;
        await this.getAccessToken(true);
        attempt--; // a forced refresh does not count as a retry
        continue;
      }
      if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8000)
          : RETRY_DELAYS_MS[attempt]!;
        await res.body?.cancel();
        await sleep(delay);
        continue;
      }

      const text = await res.text();
      if (!res.ok) {
        const { message, reason } = parseGoogleError(res.status, text);
        if (res.status === 401) {
          await markNeedsReauth(this.conn.id, message);
          throw new ReauthRequiredError(this.conn.id);
        }
        throw new GoogleApiError(res.status, message, reason);
      }
      if (!text.trim()) return {} as T;
      return JSON.parse(text) as T;
    }
  }

  /** Follows `nextPageToken` and concatenates `key` arrays from every page. */
  async paginate<T>(
    url: string,
    key: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T[]> {
    const items: T[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const page = await this.request<Record<string, unknown> & { nextPageToken?: string }>(url, {
        query: { ...query, pageToken },
      });
      const batch = page[key];
      if (Array.isArray(batch)) items.push(...(batch as T[]));
      pageToken = page.nextPageToken || undefined;
    } while (pageToken && ++guard < 500);
    return items;
  }
}

/** Human-readable message for any Google-related error (for `last_error` fields). */
export function googleErrorMessage(err: unknown): string {
  if (err instanceof ReauthRequiredError || err instanceof GoogleApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown Google error.';
}
