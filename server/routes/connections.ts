import { Hono } from 'hono';
import type { ConnectionDTO } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { embeddedCount } from '../db/mappers.js';
import { db } from '../db/supabase.js';
import { decrypt } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';
import { googleErrorMessage } from '../google/client.js';
import { GoogleApiError, ReauthRequiredError } from '../google/errors.js';
import { revokeToken } from '../google/oauth.js';
import { syncConnection } from '../google/sync.js';

export const connectionRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = unwrap(
      await db()
        .from('google_connections')
        .select(
          'id, email, display_name, avatar_url, status, last_synced_at, last_error, created_at, gbp_accounts(count), location_access(count)',
        )
        .order('created_at', { ascending: true }),
      'Load connections',
    );
    const items: ConnectionDTO[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      status: r.status,
      last_synced_at: r.last_synced_at,
      last_error: r.last_error,
      created_at: r.created_at,
      account_count: embeddedCount(r.gbp_accounts),
      location_count: embeddedCount(r.location_access),
    }));
    return c.json(items);
  })

  .post('/:id/sync', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    unwrapOne(await db().from('google_connections').select('id').eq('id', id).maybeSingle(), 'Connection');
    try {
      return c.json(await syncConnection(id, c.get('user').id));
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        throw new ApiError(409, 'needs_reauth', err.message);
      }
      if (err instanceof GoogleApiError) {
        throw new ApiError(502, 'google_error', `Sync failed: ${googleErrorMessage(err)}`);
      }
      throw err;
    }
  })

  .delete('/:id', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    const conn = unwrapOne(
      await db().from('google_connections').select('*').eq('id', id).maybeSingle(),
      'Connection',
    );
    let revoked = false;
    const token = conn.refresh_token_enc ?? conn.access_token_enc;
    if (token) {
      try {
        revoked = await revokeToken(decrypt(token));
      } catch {
        revoked = false;
      }
    }
    unwrap(
      await db()
        .from('google_connections')
        .update({
          status: 'revoked',
          refresh_token_enc: null,
          access_token_enc: null,
          access_token_expires_at: null,
          last_error: null,
        })
        .eq('id', id),
      'Disconnect',
    );
    // The account can no longer manage these profiles through OrbitPost.
    unwrap(await db().from('location_access').delete().eq('connection_id', id), 'Remove access');
    unwrap(
      await db().from('locations').update({ default_connection_id: null }).eq('default_connection_id', id),
      'Clear default connection',
    );
    await logActivity({
      actor: c.get('user').id,
      action: 'connection.disconnected',
      entityType: 'connection',
      entityId: id,
      details: { email: conn.email, tokenRevoked: revoked },
    });
    return c.json({ ok: true, tokenRevoked: revoked });
  });
