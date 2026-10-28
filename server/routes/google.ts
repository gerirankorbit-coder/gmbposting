import { Hono } from 'hono';
import { logActivity } from '../db/activity.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { encrypt, signState, verifyState } from '../lib/crypto.js';
import { env } from '../lib/env.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';
import { buildAuthUrl, exchangeCode, fetchUserInfo, GOOGLE_SCOPES } from '../google/oauth.js';
import { googleErrorMessage } from '../google/client.js';
import { z } from 'zod';
import { parseBody } from '../lib/validate.js';

const STATE_TTL_SECONDS = 10 * 60;

interface OAuthState {
  uid: string;
}

function redirectToApp(path: string, params: Record<string, string>): string {
  const url = new URL(path, `${env.appUrl}/`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Public: Google redirects here after consent. Protected by the signed `state`. */
export const googleCallbackRoutes = new Hono().get('/callback', async (c) => {
  const fail = (message: string) => c.redirect(redirectToApp('/connections', { error: message }), 302);

  const { code, state, error } = c.req.query();
  if (error) {
    return fail(error === 'access_denied' ? 'Google access was not granted.' : `Google returned: ${error}`);
  }
  if (!code || !state) return fail('The Google response was missing required parameters.');
  const payload = verifyState<OAuthState>(state);
  if (!payload) return fail('The connection request expired or was tampered with. Please try again.');

  try {
    const token = await exchangeCode(code);
    const granted = (token.scope ?? '').split(' ');
    if (!granted.includes(GOOGLE_SCOPES[3]!)) {
      return fail('Business Profile access was not granted. Please allow "manage your Business Profiles" when connecting.');
    }
    const user = await fetchUserInfo(token.access_token);
    if (!user.sub || !user.email) return fail('Google did not return the account email.');

    const existing = unwrap(
      await db().from('google_connections').select('id, refresh_token_enc').eq('google_sub', user.sub).maybeSingle(),
      'Load connection',
    );
    const refreshEnc = token.refresh_token
      ? encrypt(token.refresh_token)
      : existing?.refresh_token_enc ?? null;
    if (!refreshEnc) {
      return fail('Google did not return a refresh token. Remove OrbitPost from the Google account permissions page and connect again.');
    }

    const record = {
      google_sub: user.sub,
      email: user.email.toLowerCase(),
      display_name: user.name ?? null,
      avatar_url: user.picture ?? null,
      refresh_token_enc: refreshEnc,
      access_token_enc: encrypt(token.access_token),
      access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scopes: token.scope ?? GOOGLE_SCOPES.join(' '),
      status: 'active' as const,
      last_error: null,
      connected_by: payload.uid,
    };
    const saved = unwrapOne(
      await db().from('google_connections').upsert(record, { onConflict: 'google_sub' }).select('id').single(),
      'Save connection',
    );
    // A successful reconnect clears the matching "needs reconnecting" alert.
    await db()
      .from('notifications')
      .update({ is_read: true })
      .eq('dedupe_key', `connection_needs_reauth:${saved.id}`)
      .eq('is_read', false);
    await logActivity({
      actor: payload.uid,
      action: existing ? 'connection.reconnected' : 'connection.connected',
      entityType: 'connection',
      entityId: saved.id,
      details: { email: record.email },
    });
    return c.redirect(redirectToApp('/connections', { connected: saved.id }), 302);
  } catch (err) {
    console.error('[google callback]', googleErrorMessage(err));
    return fail(`Could not connect the Google account: ${googleErrorMessage(err)}`);
  }
});

const connectSchema = z.object({ loginHint: z.string().email().optional() });

/** Authenticated: returns the Google consent URL (the browser then navigates to it). */
export const googleRoutes = new Hono<AuthEnv>().post('/connect', requireRole('admin'), async (c) => {
  const body = await parseBody(c, connectSchema);
  const state = signState<OAuthState>({ uid: c.get('user').id }, STATE_TTL_SECONDS);
  return c.json({ url: buildAuthUrl(state, body.loginHint) });
});
