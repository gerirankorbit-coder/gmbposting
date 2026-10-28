import { Hono } from 'hono';
import { clientInputSchema, clientMergeSchema, clientUpdateSchema } from '../../shared/schemas.js';
import { logActivity } from '../db/activity.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { embeddedCount, toClientDTO } from '../db/mappers.js';
import { db } from '../db/supabase.js';
import { badRequest } from '../lib/errors.js';
import { parseBody } from '../lib/validate.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';

async function loadClient(id: string) {
  const row = unwrapOne(
    await db().from('clients').select('*, locations(count)').eq('id', id).maybeSingle(),
    'Client',
  );
  return toClientDTO(row, embeddedCount(row.locations));
}

export const clientRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = unwrap(
      await db().from('clients').select('*, locations(count)').order('name'),
      'Load clients',
    );
    return c.json(rows.map((r) => toClientDTO(r, embeddedCount(r.locations))));
  })

  .get('/:id', async (c) => c.json(await loadClient(c.req.param('id'))))

  .post('/', requireRole('manager'), async (c) => {
    const body = await parseBody(c, clientInputSchema);
    const row = unwrapOne(await db().from('clients').insert(body).select('id').single(), 'Create client');
    await logActivity({
      actor: c.get('user').id,
      action: 'client.created',
      entityType: 'client',
      entityId: row.id,
      details: { name: body.name },
    });
    return c.json(await loadClient(row.id), 201);
  })

  .patch('/:id', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, clientUpdateSchema);
    // `partial()` keeps defaults; only send keys the caller actually provided.
    const raw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => k in raw),
    ) as Partial<typeof body>;
    if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
    unwrapOne(
      await db().from('clients').update(patch).eq('id', id).select('id').maybeSingle(),
      'Client',
    );
    await logActivity({
      actor: c.get('user').id,
      action: 'client.updated',
      entityType: 'client',
      entityId: id,
      details: { changes: Object.keys(patch) },
    });
    return c.json(await loadClient(id));
  })

  .delete('/:id', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const client = await loadClient(id);
    unwrap(await db().from('clients').delete().eq('id', id), 'Delete client');
    await logActivity({
      actor: c.get('user').id,
      action: 'client.deleted',
      entityType: 'client',
      entityId: id,
      details: { name: client.name, locations: client.location_count },
    });
    return c.json({ ok: true });
  })

  /** Moves locations and images from `sourceIds` into this client, then deletes the sources. */
  .post('/:id/merge', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const { sourceIds } = await parseBody(c, clientMergeSchema);
    const sources = sourceIds.filter((s) => s !== id);
    if (!sources.length) throw badRequest('Choose at least one other client to merge.');
    const target = await loadClient(id);
    const found = unwrap(await db().from('clients').select('id, name').in('id', sources), 'Load clients');
    if (found.length !== sources.length) throw badRequest('One or more clients no longer exist.');
    unwrap(await db().from('locations').update({ client_id: id }).in('client_id', sources), 'Move locations');
    unwrap(await db().from('image_library').update({ client_id: id }).in('client_id', sources), 'Move images');
    unwrap(await db().from('notifications').delete().in('client_id', sources), 'Clear notifications');
    unwrap(await db().from('clients').delete().in('id', sources), 'Delete merged clients');
    await logActivity({
      actor: c.get('user').id,
      action: 'client.merged',
      entityType: 'client',
      entityId: id,
      details: { into: target.name, merged: found.map((f) => f.name) },
    });
    return c.json(await loadClient(id));
  });
