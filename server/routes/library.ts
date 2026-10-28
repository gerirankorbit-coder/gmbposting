import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  brandedPreviewSchema,
  brandKitSchema,
  libraryCompleteSchema,
  libraryImageUpdateSchema,
  uploadCompleteSchema,
} from '../../shared/schemas.js';
import type { ClientStockDTO, LibraryImageDTO, LibraryUploadResult } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { embeddedCount, toClientDTO } from '../db/mappers.js';
import { db } from '../db/supabase.js';
import type { ClientRow, ImageLibraryRow } from '../db/types.js';
import { badRequest, conflict, forbidden } from '../lib/errors.js';
import { downloadObject, putObject, removeObjects } from '../lib/storage.js';
import { parseBody } from '../lib/validate.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';
import { logoDataUri, renderBranded, resolveColors, topicLabel } from '../images/branded.js';
import { checkStock, stockStateFor, thresholdFor } from '../images/library.js';
import { processImage, processLogo } from '../images/process.js';

function toImageDTO(r: ImageLibraryRow): LibraryImageDTO {
  return {
    id: r.id,
    client_id: r.client_id,
    location_id: r.location_id,
    public_url: r.public_url,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    original_filename: r.original_filename,
    used_count: r.used_count,
    last_used_at: r.last_used_at,
    is_active: r.is_active,
    created_at: r.created_at,
  };
}

function assertOwnUpload(path: string, userId: string) {
  if (path.split('/')[1] !== userId.replace(/[^\w-]/g, '')) throw forbidden('This upload belongs to someone else.');
}

/** Builds stock DTOs, projecting the run-out date from upcoming auto-image posts. */
export async function stockFor(clients: (ClientRow & { locations?: unknown })[]): Promise<ClientStockDTO[]> {
  if (!clients.length) return [];
  const stock = unwrap(await db().rpc('library_stock', { p_client_id: null }), 'Library stock');
  const byClient = new Map(stock.map((s) => [s.client_id, s]));
  const upcoming = unwrap(
    await db()
      .from('posts')
      .select('scheduled_at, location:locations!inner(client_id)')
      .eq('image_source', 'auto')
      .in('status', ['pending_approval', 'scheduled'])
      .in('location.client_id', clients.map((c) => c.id))
      .order('scheduled_at', { ascending: true, nullsFirst: true })
      .limit(5000),
    'Upcoming auto posts',
  );
  const times = new Map<string, (string | null)[]>();
  for (const p of upcoming) {
    const cid = p.location?.client_id;
    if (!cid) continue;
    times.set(cid, [...(times.get(cid) ?? []), p.scheduled_at]);
  }
  return clients.map((c) => {
    const s = byClient.get(c.id);
    const unused = s?.unused_images ?? 0;
    const threshold = thresholdFor(c);
    const queue = times.get(c.id) ?? [];
    // The post after the last unused image is the first one without a library image.
    const runOut = queue[unused];
    return {
      client: toClientDTO(c, embeddedCount(c.locations)),
      total: s?.total_images ?? 0,
      unused,
      threshold,
      state: stockStateFor(unused, threshold),
      upcoming_auto_posts: s?.upcoming_auto_posts ?? 0,
      runs_out_at: runOut === undefined ? null : (runOut ?? new Date().toISOString()),
    };
  });
}

async function loadClient(id: string): Promise<ClientRow & { locations: unknown }> {
  return unwrapOne(await db().from('clients').select('*, locations(count)').eq('id', id).maybeSingle(), 'Client');
}

export const libraryRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    let q = db().from('clients').select('*, locations(count)').order('name');
    if (c.req.query('all') !== '1') q = q.eq('is_active', true);
    const clients = unwrap(await q, 'Load clients');
    const items = await stockFor(clients);
    items.sort((a, b) => a.unused - b.unused || a.client.name.localeCompare(b.client.name));
    return c.json(items);
  })

  .get('/:clientId', async (c) => {
    const client = await loadClient(c.req.param('clientId'));
    const images = unwrap(
      await db().from('image_library').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(2000),
      'Load images',
    );
    const [stock] = await stockFor([client]);
    return c.json({ stock: stock!, images: images.map(toImageDTO) });
  })

  /** Processes up to 5 raw uploads into the client's library, skipping exact duplicates. */
  .post('/:clientId/images', async (c) => {
    const user = c.get('user');
    const client = await loadClient(c.req.param('clientId'));
    const body = await parseBody(c, libraryCompleteSchema);
    if (body.location_id) {
      const loc = unwrap(await db().from('locations').select('client_id').eq('id', body.location_id).maybeSingle(), 'Location');
      if (loc?.client_id !== client.id) throw badRequest('That location does not belong to this client.');
    }
    const result: LibraryUploadResult = { added: 0, duplicates: 0, errors: [] };
    for (const [i, path] of body.paths.entries()) {
      assertOwnUpload(path, user.id);
      const name = body.filenames?.[i] ?? path.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '');
      try {
        const image = await processImage(await downloadObject(path));
        const existing = unwrap(
          await db().from('image_library').select('id').eq('client_id', client.id).eq('content_hash', image.hash).maybeSingle(),
          'Check duplicate',
        );
        if (existing) {
          result.duplicates++;
          continue;
        }
        const storagePath = `library/${client.id}/${randomUUID()}.jpg`;
        const url = await putObject(storagePath, image.buffer, 'image/jpeg');
        unwrap(
          await db().from('image_library').insert({
            client_id: client.id,
            location_id: body.location_id ?? null,
            storage_path: storagePath,
            public_url: url,
            width: image.width,
            height: image.height,
            bytes: image.bytes,
            content_hash: image.hash,
            original_filename: name,
            uploaded_by: user.id,
          }),
          'Save image',
        );
        result.added++;
      } catch (err) {
        result.errors.push(`${name}: ${err instanceof Error ? err.message : 'could not be processed'}`);
      } finally {
        await removeObjects([path]);
      }
    }
    if (result.added) {
      await checkStock(client);
      await logActivity({
        actor: user.id,
        action: 'library.images_added',
        entityType: 'client',
        entityId: client.id,
        details: { client: client.name, added: result.added, duplicates: result.duplicates },
      });
    }
    return c.json(result);
  })

  .patch('/images/:id', requireRole('manager'), async (c) => {
    const body = await parseBody(c, libraryImageUpdateSchema);
    const img = unwrapOne(await db().from('image_library').select('*').eq('id', c.req.param('id')).maybeSingle(), 'Image');
    if (body.location_id) {
      const loc = unwrap(await db().from('locations').select('client_id').eq('id', body.location_id).maybeSingle(), 'Location');
      if (loc?.client_id !== img.client_id) throw badRequest('That location does not belong to this client.');
    }
    const updated = unwrapOne(await db().from('image_library').update(body).eq('id', img.id).select('*').single(), 'Update image');
    const client = await loadClient(img.client_id);
    await checkStock(client);
    return c.json(toImageDTO(updated));
  })

  .delete('/images/:id', requireRole('manager'), async (c) => {
    const img = unwrapOne(await db().from('image_library').select('*').eq('id', c.req.param('id')).maybeSingle(), 'Image');
    const inUse = unwrap(
      await db().from('posts').select('id').eq('image_library_id', img.id).in('status', ['draft', 'pending_approval', 'scheduled', 'failed', 'publishing']).limit(1),
      'Check usage',
    );
    if (inUse.length) throw conflict('This image is attached to a post that has not been published yet. Deactivate it instead.');
    unwrap(await db().from('image_library').delete().eq('id', img.id), 'Delete image');
    await removeObjects([img.storage_path]);
    const client = await loadClient(img.client_id);
    await checkStock(client);
    await logActivity({ actor: c.get('user').id, action: 'library.image_deleted', entityType: 'client', entityId: img.client_id, details: { file: img.original_filename } });
    return c.json({ ok: true });
  })

  .patch('/:clientId/brand', requireRole('manager'), async (c) => {
    const client = await loadClient(c.req.param('clientId'));
    const body = await parseBody(c, brandKitSchema);
    unwrap(await db().from('clients').update(body).eq('id', client.id), 'Save brand kit');
    const fresh = await loadClient(client.id);
    if (body.low_stock_threshold !== undefined || body.on_library_exhausted !== undefined) await checkStock(fresh);
    await logActivity({ actor: c.get('user').id, action: 'client.brand_kit_updated', entityType: 'client', entityId: client.id, details: { fields: Object.keys(body) } });
    return c.json(toClientDTO(await loadClient(client.id), embeddedCount(fresh.locations)));
  })

  .post('/:clientId/logo', requireRole('manager'), async (c) => {
    const client = await loadClient(c.req.param('clientId'));
    const { path } = await parseBody(c, uploadCompleteSchema);
    assertOwnUpload(path, c.get('user').id);
    let logo;
    try {
      logo = await processLogo(await downloadObject(path));
    } finally {
      await removeObjects([path]);
    }
    const storagePath = `brand/${client.id}/logo-${randomUUID()}.png`;
    const url = await putObject(storagePath, logo.buffer, 'image/png');
    unwrap(await db().from('clients').update({ logo_url: url, logo_path: storagePath }).eq('id', client.id), 'Save logo');
    if (client.logo_path) await removeObjects([client.logo_path]);
    return c.json(toClientDTO(await loadClient(client.id), embeddedCount(client.locations)));
  })

  .delete('/:clientId/logo', requireRole('manager'), async (c) => {
    const client = await loadClient(c.req.param('clientId'));
    unwrap(await db().from('clients').update({ logo_url: null, logo_path: null }).eq('id', client.id), 'Remove logo');
    if (client.logo_path) await removeObjects([client.logo_path]);
    return c.json(toClientDTO(await loadClient(client.id), embeddedCount(client.locations)));
  })

  /** Renders one branded template with the saved brand kit plus unsaved overrides (PNG). */
  .post('/:clientId/preview', async (c) => {
    const client = await loadClient(c.req.param('clientId'));
    const body = await parseBody(c, brandedPreviewSchema);
    const merged = { ...client, ...body.overrides };
    const colors = resolveColors(merged);
    const loc = unwrap(await db().from('locations').select('city').eq('client_id', client.id).not('city', 'is', null).limit(1), 'Location');
    const png = await renderBranded(body.template, {
      headline: body.headline || (body.topic === 'STANDARD' ? 'Fresh Ideas For Your Next Project' : 'Save 15% This Week Only'),
      businessName: client.name,
      city: loc[0]?.city ?? null,
      tagline: merged.tagline ?? null,
      logo: await logoDataUri(client.logo_url),
      ...colors,
      variant: 0,
      topicLabel: topicLabel(body.topic),
    });
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  });
