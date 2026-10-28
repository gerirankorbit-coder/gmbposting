import type { PostgrestError } from '@supabase/supabase-js';
import { Hono } from 'hono';
import type { ActivityDTO, ClientRef, DashboardDTO } from '../../shared/types.js';
import { dbError, unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { actorNames } from '../lib/users.js';
import type { AuthEnv } from '../middleware/auth.js';
import { POST_LIST_SELECT, toListItem } from '../posts/queries.js';
import { stockFor } from './library.js';

const STALE_DAYS = 7;

async function count(q: PromiseLike<{ count: number | null; error: PostgrestError | null }>, what: string): Promise<number> {
  const { count: n, error } = await q;
  if (error) throw dbError(error, what);
  return n ?? 0;
}

export const dashboardRoutes = new Hono<AuthEnv>().get('/', async (c) => {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const head = { count: 'exact' as const, head: true };

  const [connections, reauth, locations, scheduledWeek, publishedMonth, failed, pending, staleCount] = await Promise.all([
    count(db().from('google_connections').select('id', head).eq('status', 'active'), 'Count connections'),
    count(db().from('google_connections').select('id', head).eq('status', 'needs_reauth'), 'Count reconnects'),
    count(db().from('locations').select('id', head).eq('is_active', true), 'Count locations'),
    count(db().from('posts').select('id', head).eq('status', 'scheduled').lte('scheduled_at', weekAhead), 'Count scheduled'),
    count(db().from('posts').select('id', head).eq('status', 'published').gte('published_at', monthStart), 'Count published'),
    count(db().from('posts').select('id', head).eq('status', 'failed'), 'Count failed'),
    count(db().from('posts').select('id', head).eq('status', 'pending_approval'), 'Count pending'),
    count(db().from('locations').select('id', head).eq('is_active', true).or(`last_post_at.is.null,last_post_at.lt.${staleCutoff}`), 'Count stale'),
  ]);

  const [upcoming, stale, clients, activity] = await Promise.all([
    db().from('posts').select(POST_LIST_SELECT).in('status', ['scheduled', 'pending_approval']).order('scheduled_at', { ascending: true, nullsFirst: true }).limit(8),
    db()
      .from('locations')
      .select('id, title, city, last_post_at, client:clients(id, name, color)')
      .eq('is_active', true)
      .or(`last_post_at.is.null,last_post_at.lt.${staleCutoff}`)
      .order('last_post_at', { ascending: true, nullsFirst: true })
      .limit(8),
    db().from('clients').select('*, locations(count)').eq('is_active', true),
    db().from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
  ]);
  const activityRows = unwrap(activity, 'Load activity');
  const names = await actorNames(activityRows.map((a) => a.actor));
  const stock = await stockFor(unwrap(clients, 'Load clients'));
  stock.sort((a, b) => a.unused - b.unused);

  const body: DashboardDTO = {
    stats: {
      connections,
      connections_needing_reauth: reauth,
      locations,
      scheduled_this_week: scheduledWeek,
      published_this_month: publishedMonth,
      failed,
      pending_approval: pending,
    },
    upcoming: (unwrap(upcoming, 'Load upcoming') as unknown as Parameters<typeof toListItem>[0][]).map(toListItem),
    stale_locations: unwrap(stale, 'Load stale locations').map((l) => ({ id: l.id, title: l.title, city: l.city, last_post_at: l.last_post_at, client: l.client as ClientRef | null })),
    stale_count: staleCount,
    image_stock: stock.slice(0, 6),
    activity: activityRows.map(
      (a): ActivityDTO => ({
        id: a.id,
        actor: a.actor,
        actor_name: names.get(a.actor) ?? 'Former team member',
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        details: (a.details ?? {}) as Record<string, unknown>,
        created_at: a.created_at,
      }),
    ),
  };
  return c.json(body);
});
