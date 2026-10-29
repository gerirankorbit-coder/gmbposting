import { Hono } from 'hono';
import { postingBlock, postingBlockMessage } from '../../shared/posting.js';
import { postingStatusQuerySchema } from '../../shared/schemas.js';
import type { PostingStatusClient, PostingStatusLocation, PostStatus } from '../../shared/types.js';
import { chunk, ilikePattern, unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { parseQuery } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';

interface PostLite {
  location_id: string;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  last_error: string | null;
  google_search_url: string | null;
  updated_at: string;
}

const max = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const min = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);

/**
 * Active clients and, for each of their locations, whether it got a post in the period and why
 * not. "Posted" also counts posts made outside OrbitPost (last_post_at from Google's history).
 */
export const postingStatusRoutes = new Hono<AuthEnv>().get('/', async (c) => {
  const q = parseQuery(c, postingStatusQuerySchema);
  const since = new Date(q.since).toISOString();

  let clientQuery = db().from('clients').select('id, name, color').eq('is_active', true).order('name').limit(2000);
  if (q.search) clientQuery = clientQuery.ilike('name', ilikePattern(q.search));
  const clients = unwrap(await clientQuery, 'Load clients');

  const locations: {
    id: string;
    title: string;
    city: string | null;
    client_id: string | null;
    is_active: boolean;
    google_verified: boolean | null;
    last_post_at: string | null;
    maps_uri: string | null;
    access: { connection: { status: string } | null }[];
  }[] = [];
  for (const ids of chunk(clients.map((cl) => cl.id), 200)) {
    const rows = unwrap(
      await db()
        .from('locations')
        .select('id, title, city, client_id, is_active, google_verified, last_post_at, maps_uri, access:location_access(connection:google_connections(status))')
        .in('client_id', ids)
        .order('title')
        .limit(20000),
      'Load locations',
    );
    locations.push(...(rows as unknown as typeof locations));
  }

  const posts: PostLite[] = [];
  for (const ids of chunk(locations.map((l) => l.id), 200)) {
    const rows = unwrap(
      await db()
        .from('posts')
        .select('location_id, status, scheduled_at, published_at, last_error, google_search_url, updated_at')
        .in('location_id', ids)
        .or(`published_at.gte.${since},status.in.(scheduled,publishing,pending_approval),and(status.in.(failed,draft),updated_at.gte.${since})`)
        .order('updated_at', { ascending: false })
        .limit(50000),
      'Load posts',
    );
    posts.push(...(rows as PostLite[]));
  }
  const postsByLoc = new Map<string, PostLite[]>();
  for (const p of posts) postsByLoc.set(p.location_id, [...(postsByLoc.get(p.location_id) ?? []), p]);

  const statusFor = (l: (typeof locations)[number]): PostingStatusLocation => {
    const mine = postsByLoc.get(l.id) ?? [];
    const published = mine.filter((p) => p.status === 'published' && p.published_at && p.published_at >= since);
    let lastPublished = l.last_post_at && l.last_post_at >= since ? l.last_post_at : null;
    let googleUrl: string | null = null;
    for (const p of published) {
      if (!lastPublished || p.published_at! >= lastPublished) googleUrl = p.google_search_url ?? googleUrl;
      lastPublished = max(lastPublished, p.published_at);
    }
    const nextScheduled = mine
      .filter((p) => p.status === 'scheduled' || p.status === 'publishing')
      .reduce<string | null>((acc, p) => min(acc, p.scheduled_at), null);
    const base = {
      id: l.id,
      title: l.title,
      city: l.city,
      last_published_at: lastPublished,
      google_url: googleUrl,
      next_scheduled_at: nextScheduled,
      maps_uri: l.maps_uri,
    };
    if (lastPublished) return { ...base, state: 'posted', reason: null, block: null };

    const block = postingBlock({ ...l, client: { name: '', is_active: true } });
    if (block === 'location_off' || block === 'unverified') {
      return { ...base, state: 'cant_post', block, reason: postingBlockMessage({ ...l, client: null }, block) };
    }
    if (!l.access.some((a) => a.connection?.status === 'active')) {
      return {
        ...base,
        state: 'cant_post',
        block: 'reconnect',
        reason: 'No connected Gmail can post for this location. Reconnect its Gmail on the Connections page.',
      };
    }
    const failed = mine.find((p) => p.status === 'failed');
    if (failed) return { ...base, state: 'failed', block: null, reason: failed.last_error ?? 'Publishing failed.' };
    if (nextScheduled) return { ...base, state: 'scheduled', block: null, reason: 'Scheduled, not published yet.' };
    if (mine.some((p) => p.status === 'pending_approval')) {
      return { ...base, state: 'pending_approval', block: null, reason: 'Waiting for approval in Approvals.' };
    }
    if (mine.some((p) => p.status === 'draft')) {
      return { ...base, state: 'draft', block: null, reason: 'Saved as a draft; not submitted or scheduled.' };
    }
    return { ...base, state: 'not_posted', block: null, reason: 'No post was created for this period.' };
  };

  const byClient = new Map<string, PostingStatusLocation[]>();
  for (const l of locations) if (l.client_id) byClient.set(l.client_id, [...(byClient.get(l.client_id) ?? []), statusFor(l)]);
  const body: PostingStatusClient[] = clients.map((cl) => ({ ...cl, locations: byClient.get(cl.id) ?? [] }));
  return c.json(body);
});
