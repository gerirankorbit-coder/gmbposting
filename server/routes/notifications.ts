import { Hono } from 'hono';
import { notificationListQuerySchema, postIdsSchema } from '../../shared/schemas.js';
import type { NotificationDTO, NotificationFeedDTO, SystemAlertsDTO } from '../../shared/types.js';
import { dbError, pageRange, unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { parseBody, parseQuery } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';

export const notificationRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const q = parseQuery(c, notificationListQuerySchema);
    let query = db().from('notifications').select('*, client:clients(name)', { count: 'exact' });
    if (q.type) query = query.eq('type', q.type);
    if (q.clientId) query = query.eq('client_id', q.clientId);
    if (q.unread === '1') query = query.eq('is_read', false);
    const [from, to] = pageRange(q.page, q.pageSize);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw dbError(error, 'Load notifications');
    const { count: unread, error: unreadError } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (unreadError) throw dbError(unreadError, 'Count notifications');
    const items: NotificationDTO[] = (data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      client_id: n.client_id,
      client_name: n.client?.name ?? null,
      title: n.title,
      body: n.body,
      link: n.link,
      is_read: n.is_read,
      created_at: n.created_at,
    }));
    const body: NotificationFeedDTO = { items, total: count ?? 0, page: q.page, pageSize: q.pageSize, unread: unread ?? 0 };
    return c.json(body);
  })

  .get('/alerts', async (c) => {
    const [conns, clients] = await Promise.all([
      db().from('google_connections').select('id, email').eq('status', 'needs_reauth'),
      db().from('clients').select('id, name').eq('is_active', true).eq('stock_state', 'empty').order('name'),
    ]);
    const body: SystemAlertsDTO = {
      needsReauth: unwrap(conns, 'Load connections'),
      emptyLibraries: unwrap(clients, 'Load clients'),
    };
    return c.json(body);
  })

  .post('/read', async (c) => {
    const { ids } = await parseBody(c, postIdsSchema);
    unwrap(await db().from('notifications').update({ is_read: true }).in('id', ids), 'Mark read');
    return c.json({ ok: true });
  })

  .post('/read-all', async (c) => {
    unwrap(await db().from('notifications').update({ is_read: true }).eq('is_read', false), 'Mark all read');
    return c.json({ ok: true });
  });
