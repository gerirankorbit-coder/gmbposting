import type { StockState } from '../../shared/types.js';
import { unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import type { ClientRow, ImageLibraryRow } from '../db/types.js';
import { env } from '../lib/env.js';
import { notify, resolveNotifications } from '../notify/index.js';

const RANK: Record<StockState, number> = { ok: 2, low: 1, empty: 0 };

export function thresholdFor(client: Pick<ClientRow, 'low_stock_threshold'>): number {
  return client.low_stock_threshold ?? env.lowStockThreshold;
}

export function stockStateFor(unused: number, threshold: number): StockState {
  if (unused <= 0) return 'empty';
  if (unused <= threshold) return 'low';
  return 'ok';
}

const keyFor = (type: string, clientId: string, state: StockState) => `${type}:${clientId}:${state}`;

/**
 * Recomputes a client's unused-image stock and notifies once per state change:
 * low → `library_low`, empty → `library_empty`, improvement after upload → `library_refilled`.
 * Inactive clients are tracked silently.
 */
export async function checkStock(
  client: Pick<ClientRow, 'id' | 'name' | 'is_active' | 'stock_state' | 'low_stock_threshold' | 'on_library_exhausted'>,
): Promise<{ state: StockState; unused: number; total: number }> {
  const [stock] = unwrap(await db().rpc('library_stock', { p_client_id: client.id }), 'Library stock');
  const unused = stock?.unused_images ?? 0;
  const total = stock?.total_images ?? 0;
  const state = stockStateFor(unused, thresholdFor(client));
  const previous = client.stock_state;
  if (state === previous) return { state, unused, total };

  unwrap(await db().from('clients').update({ stock_state: state }).eq('id', client.id), 'Save stock state');
  if (!client.is_active) return { state, unused, total };
  const link = `/library/${client.id}`;
  const fallback = client.on_library_exhausted === 'recycle' ? 'Older images are being reused' : 'Branded graphics are being used';

  if (RANK[state] < RANK[previous]) {
    if (state === 'empty') {
      await notify({
        type: 'library_empty',
        clientId: client.id,
        title: `${client.name} is out of images`,
        body: `${fallback} until you add new ones.`,
        link,
        dedupeKey: keyFor('library_empty', client.id, 'empty'),
      });
    } else {
      await notify({
        type: 'library_low',
        clientId: client.id,
        title: `${client.name} has ${unused} image${unused === 1 ? '' : 's'} left`,
        body: `Add new images to avoid ${client.on_library_exhausted === 'recycle' ? 'reusing old images' : 'auto-generated graphics'}.`,
        link,
        dedupeKey: keyFor('library_low', client.id, 'low'),
      });
    }
  } else {
    // Improved (typically after an upload). Old low/empty alerts no longer apply.
    await resolveNotifications([keyFor('library_low', client.id, 'low'), keyFor('library_empty', client.id, 'empty')]);
    await notify({
      type: 'library_refilled',
      clientId: client.id,
      title: `${client.name} library refilled`,
      body: `${unused} unused image${unused === 1 ? '' : 's'} available. Auto posts use library images again.`,
      link,
      dedupeKey: keyFor('library_refilled', client.id, state),
    });
  }
  return { state, unused, total };
}

export async function checkAllStock(): Promise<number> {
  const clients = unwrap(
    await db().from('clients').select('id, name, is_active, stock_state, low_stock_threshold, on_library_exhausted'),
    'Load clients',
  );
  let changed = 0;
  for (const c of clients) {
    const before = c.stock_state;
    const { state } = await checkStock(c);
    if (state !== before) changed++;
  }
  return changed;
}

/**
 * Atomically picks the next image for a post at a location (location-specific unused first,
 * then client-wide, oldest first). With `recycle`, falls back to the least recently used image.
 */
export async function pickLibraryImage(clientId: string, locationId: string, allowRecycle: boolean): Promise<ImageLibraryRow | null> {
  const rows = unwrap(
    await db().rpc('pick_library_image', { p_client_id: clientId, p_location_id: locationId, p_allow_recycle: allowRecycle }),
    'Pick library image',
  );
  return rows[0] ?? null;
}
