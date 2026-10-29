import { logActivity } from '../db/activity.js';
import { chunk, unwrap, unwrapOne } from '../db/helpers.js';
import { getSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
import type { LocationRow } from '../db/types.js';
import { GoogleClient, googleErrorMessage } from './client.js';
import { listAccounts, type GbpAccount } from './accounts.js';
import { guessLocationTimeZone, listLocations, normalizeLocation, type NormalizedLocation } from './locations.js';
import { ReauthRequiredError } from './errors.js';

export interface SyncResult {
  connectionId: string;
  email: string;
  accounts: number;
  locations: number;
  newLocations: number;
  newClients: number;
  removedAccess: number;
  complete: boolean;
  errors: string[];
}

const CLIENT_COLORS = ['#8B2CF5', '#D946EF', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#6366F1', '#14B8A6', '#EC4899'];

function pickColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CLIENT_COLORS[h % CLIENT_COLORS.length]!;
}

/** Ensures each location without a client gets one (reusing a client with the same name). */
async function assignClients(locations: Pick<LocationRow, 'id' | 'title' | 'client_id'>[]): Promise<number> {
  const orphans = locations.filter((l) => !l.client_id);
  if (!orphans.length) return 0;
  const existing = unwrap(await db().from('clients').select('id, name'), 'Load clients');
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let created = 0;
  for (const loc of orphans) {
    const key = loc.title.trim().toLowerCase();
    let clientId = byName.get(key);
    if (!clientId) {
      const client = unwrapOne(
        await db()
          .from('clients')
          // Clients found through a Google sync start inactive: nothing posts for them until the
          // team activates them.
          .insert({ name: loc.title.trim(), color: pickColor(key), is_active: false })
          .select('id')
          .single(),
        'Create client',
      );
      clientId = client.id;
      byName.set(key, clientId);
      created++;
    }
    unwrap(await db().from('locations').update({ client_id: clientId }).eq('id', loc.id), 'Link client');
  }
  return created;
}

/**
 * Full sync of one Google connection: accounts, their locations, and location_access rows.
 * Access rows not seen are removed only when every account was listed successfully.
 */
export async function syncConnection(connectionId: string, actor: string): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const client = await GoogleClient.forConnection(connectionId);
  const result: SyncResult = {
    connectionId,
    email: client.email,
    accounts: 0,
    locations: 0,
    newLocations: 0,
    newClients: 0,
    removedAccess: 0,
    complete: true,
    errors: [],
  };

  try {
    const accounts = await listAccounts(client);
    result.accounts = accounts.length;

    if (accounts.length) {
      unwrap(
        await db()
          .from('gbp_accounts')
          .upsert(
            accounts.map((a) => ({
              connection_id: connectionId,
              account_name: a.name,
              display_name: a.accountName ?? null,
              type: a.type ?? null,
              role: a.role ?? null,
            })),
            { onConflict: 'connection_id,account_name' },
          ),
        'Save accounts',
      );
    }
    const seenAccounts = accounts.map((a) => a.name);
    let staleAccounts = db().from('gbp_accounts').delete().eq('connection_id', connectionId);
    if (seenAccounts.length) {
      staleAccounts = staleAccounts.not('account_name', 'in', `(${seenAccounts.map((n) => `"${n}"`).join(',')})`);
    }
    unwrap(await staleAccounts, 'Remove stale accounts');

    // location_name -> { data, account, tz guess }
    const found = new Map<string, { data: NormalizedLocation; account: GbpAccount; tz: string | null }>();
    for (const account of accounts) {
      try {
        const locs = await listLocations(client, account.name);
        for (const loc of locs) {
          if (found.has(loc.name)) continue;
          const data = normalizeLocation(loc);
          found.set(loc.name, { data, account, tz: guessLocationTimeZone(loc, data.address_text) });
        }
      } catch (err) {
        if (err instanceof ReauthRequiredError) throw err;
        result.complete = false;
        result.errors.push(`${account.accountName ?? account.name}: ${googleErrorMessage(err)}`);
      }
    }
    result.locations = found.size;

    const names = [...found.keys()];
    const existing = new Map<string, Pick<LocationRow, 'id' | 'title' | 'client_id' | 'location_name'>>();
    for (const part of chunk(names, 200)) {
      const rows = unwrap(
        await db().from('locations').select('id, title, client_id, location_name').in('location_name', part),
        'Load locations',
      );
      rows.forEach((r) => existing.set(r.location_name, r));
    }

    const now = new Date().toISOString();
    const settings = await getSettings();
    const toInsert = names.filter((n) => !existing.has(n));
    const toUpdate = names.filter((n) => existing.has(n));

    for (const part of chunk(toInsert, 200)) {
      const rows = unwrap(
        await db()
          .from('locations')
          .insert(
            part.map((n) => {
              const { data, tz } = found.get(n)!;
              return {
                ...data,
                timezone: tz ?? settings.default_timezone,
                timezone_source: tz ? ('auto' as const) : ('default' as const),
                synced_at: now,
              };
            }),
          )
          .select('id, title, client_id, location_name'),
        'Insert locations',
      );
      rows.forEach((r) => existing.set(r.location_name, r));
      result.newLocations += rows.length;
    }
    for (const part of chunk(toUpdate, 200)) {
      // Upsert only Google-owned columns; client and flags stay as edited by the team.
      unwrap(
        await db()
          .from('locations')
          .upsert(
            part.map((n) => ({ ...found.get(n)!.data, synced_at: now })),
            { onConflict: 'location_name' },
          ),
        'Update locations',
      );
    }

    // Auto time zones: fill from the address unless the team set one by hand.
    const byZone = new Map<string, string[]>();
    for (const n of toUpdate) {
      const tz = found.get(n)!.tz;
      if (tz) byZone.set(tz, [...(byZone.get(tz) ?? []), n]);
    }
    for (const [tz, locNames] of byZone) {
      for (const part of chunk(locNames, 200)) {
        unwrap(
          await db()
            .from('locations')
            .update({ timezone: tz, timezone_source: 'auto' })
            .in('location_name', part)
            .neq('timezone_source', 'manual'),
          'Update location time zones',
        );
      }
    }

    result.newClients = await assignClients([...existing.values()]);

    const accessRows = names.map((n) => ({
      location_id: existing.get(n)!.id,
      connection_id: connectionId,
      account_name: found.get(n)!.account.name,
      role: found.get(n)!.account.role ?? null,
      last_seen_at: now,
    }));
    for (const part of chunk(accessRows, 500)) {
      unwrap(
        await db().from('location_access').upsert(part, { onConflict: 'location_id,connection_id' }),
        'Save location access',
      );
    }

    if (result.complete) {
      const removed = unwrap(
        await db()
          .from('location_access')
          .delete()
          .eq('connection_id', connectionId)
          .lt('last_seen_at', startedAt)
          .select('id'),
        'Remove stale access',
      );
      result.removedAccess = removed.length;
    }

    await db()
      .from('google_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: result.errors.length ? result.errors.join(' | ').slice(0, 1000) : null,
      })
      .eq('id', connectionId);
  } catch (err) {
    const message = googleErrorMessage(err);
    await db().from('google_connections').update({ last_error: message }).eq('id', connectionId);
    await logActivity({
      actor,
      action: 'connection.sync_failed',
      entityType: 'connection',
      entityId: connectionId,
      details: { email: client.email, error: message },
    });
    throw err;
  }

  await logActivity({
    actor,
    action: 'connection.synced',
    entityType: 'connection',
    entityId: connectionId,
    details: {
      email: result.email,
      accounts: result.accounts,
      locations: result.locations,
      newLocations: result.newLocations,
      newClients: result.newClients,
      removedAccess: result.removedAccess,
      complete: result.complete,
      errors: result.errors,
    },
  });
  return result;
}

/** Syncs every active connection (daily cron). Errors are collected per connection. */
export async function syncAllConnections(actor: string): Promise<{ results: SyncResult[]; failures: { connectionId: string; error: string }[] }> {
  const conns = unwrap(
    await db().from('google_connections').select('id').eq('status', 'active'),
    'Load connections',
  );
  const results: SyncResult[] = [];
  const failures: { connectionId: string; error: string }[] = [];
  for (const c of conns) {
    try {
      results.push(await syncConnection(c.id, actor));
    } catch (err) {
      failures.push({ connectionId: c.id, error: googleErrorMessage(err) });
    }
  }
  return { results, failures };
}
