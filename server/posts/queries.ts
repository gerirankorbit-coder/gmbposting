import type { z } from 'zod';
import type { postListQuerySchema } from '../../shared/schemas.js';
import type { ClientRef, Paginated, PostListItemDTO } from '../../shared/types.js';
import { dbError, ilikePattern, pageRange, unwrapOne } from '../db/helpers.js';
import { toPostDTO } from '../db/mappers.js';
import { db } from '../db/supabase.js';
import type { PostRow } from '../db/types.js';

const LOCATION_EMBED = 'location:locations!inner(id, title, city, timezone, client_id, client:clients(id, name, color))';
export const POST_LIST_SELECT = `*, ${LOCATION_EMBED}, connection:google_connections(email), campaign:campaigns(id, name)`;

type RawPost = PostRow & {
  location: { id: string; title: string; city: string | null; timezone: string; client_id: string | null; client: ClientRef | null } | null;
  connection: { email: string } | null;
  campaign: { id: string; name: string } | null;
};

export function toListItem(r: RawPost): PostListItemDTO {
  return {
    ...toPostDTO(r),
    location: r.location
      ? { id: r.location.id, title: r.location.title, city: r.location.city, timezone: r.location.timezone, client: r.location.client }
      : null,
    connection_email: r.connection?.email ?? null,
    campaign: r.campaign,
  };
}

type ListInput = z.output<typeof postListQuerySchema>;

export async function listPosts(q: ListInput): Promise<Paginated<PostListItemDTO>> {
  let query = db().from('posts').select(POST_LIST_SELECT, { count: 'exact' });
  if (q.status?.length) query = query.in('status', q.status);
  if (q.clientId) query = query.eq('location.client_id', q.clientId);
  if (q.locationId) query = query.eq('location_id', q.locationId);
  if (q.connectionId) query = query.eq('connection_id', q.connectionId);
  if (q.campaignId) query = query.eq('campaign_id', q.campaignId);
  if (q.importId) query = query.eq('import_id', q.importId);
  if (q.from) query = query.gte(q.sort === 'created_at' ? 'created_at' : 'scheduled_at', q.from);
  if (q.to) query = query.lte(q.sort === 'created_at' ? 'created_at' : 'scheduled_at', q.to);
  if (q.search) query = query.ilike('summary', ilikePattern(q.search));
  const [from, to] = pageRange(q.page, q.pageSize);
  const { data, error, count } = await query
    .order(q.sort, { ascending: q.dir === 'asc', nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error, 'Load posts');
  return {
    items: ((data ?? []) as unknown as RawPost[]).map(toListItem),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function getPostItem(id: string): Promise<PostListItemDTO> {
  const row = unwrapOne(await db().from('posts').select(POST_LIST_SELECT).eq('id', id).maybeSingle(), 'Post');
  return toListItem(row as unknown as RawPost);
}

export async function getPostRow(id: string): Promise<PostRow> {
  return unwrapOne(await db().from('posts').select('*').eq('id', id).maybeSingle(), 'Post');
}
