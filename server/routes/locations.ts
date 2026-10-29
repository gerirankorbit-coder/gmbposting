import { Hono } from 'hono';
import {
  locationBulkSchema,
  locationListQuerySchema,
  locationUpdateSchema,
  paginationQuerySchema,
} from '../../shared/schemas.js';
import type {
  ClientRef,
  HistoryImportResult,
  LocationAccessDTO,
  LocationDTO,
  Paginated,
  PostDTO,
} from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { chunk, dbError, ilikePattern, pageRange, unwrap, unwrapOne } from '../db/helpers.js';
import { toPostDTO } from '../db/mappers.js';
import { db } from '../db/supabase.js';
import type { ConnectionStatus, CtaType, TopicType } from '../../shared/types.js';
import { ApiError, badRequest } from '../lib/errors.js';
import { parseBody, parseQuery } from '../lib/validate.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';
import { GoogleClient, googleErrorMessage } from '../google/client.js';
import { fromGoogleDateTime, listLocalPosts } from '../google/posts.js';

const LOCATION_SELECT = `
  id, location_name, title, address_text, city, service_area_text, primary_category,
  website_uri, maps_uri, place_id, timezone, is_active, last_post_at, synced_at,
  default_connection_id,
  client:clients(id, name, color),
  access:location_access(connection_id, account_name, role, connection:google_connections(email, status))
` as const;

interface RawLocation {
  id: string;
  location_name: string;
  title: string;
  address_text: string | null;
  city: string | null;
  service_area_text: string | null;
  primary_category: string | null;
  website_uri: string | null;
  maps_uri: string | null;
  place_id: string | null;
  timezone: string;
  is_active: boolean;
  last_post_at: string | null;
  synced_at: string | null;
  default_connection_id: string | null;
  client: ClientRef | null;
  access: Array<{
    connection_id: string;
    account_name: string;
    role: string | null;
    connection: { email: string; status: ConnectionStatus } | null;
  }>;
}

function toLocationDTO(r: RawLocation): LocationDTO {
  const access: LocationAccessDTO[] = r.access
    .filter((a) => a.connection)
    .map((a) => ({
      connection_id: a.connection_id,
      account_name: a.account_name,
      role: a.role,
      email: a.connection!.email,
      status: a.connection!.status,
    }));
  const { access: _ignored, ...rest } = r;
  return { ...rest, access };
}

async function loadLocation(id: string): Promise<LocationDTO> {
  const row = unwrapOne(
    await db().from('locations').select(LOCATION_SELECT).eq('id', id).maybeSingle(),
    'Location',
  );
  return toLocationDTO(row as unknown as RawLocation);
}

async function assertConnectionHasAccess(locationId: string, connectionId: string) {
  const access = unwrap(
    await db()
      .from('location_access')
      .select('id')
      .eq('location_id', locationId)
      .eq('connection_id', connectionId)
      .maybeSingle(),
    'Check access',
  );
  if (!access) throw badRequest('That Google account does not manage this location.');
}

export const locationRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const q = parseQuery(c, locationListQuerySchema);
    // When filtering by connection, an inner-joined alias restricts rows without trimming the
    // `access` list shown in the UI.
    const select = q.connectionId
      ? `${LOCATION_SELECT}, access_filter:location_access!inner(connection_id)`
      : LOCATION_SELECT;
    let query = db().from('locations').select(select, { count: 'exact' });
    if (q.connectionId) query = query.eq('access_filter.connection_id', q.connectionId);
    if (q.search) {
      const p = ilikePattern(q.search);
      query = query.or(`title.ilike.${p},city.ilike.${p},address_text.ilike.${p},primary_category.ilike.${p}`);
    }
    if (q.clientId === 'none') query = query.is('client_id', null);
    else if (q.clientId) query = query.eq('client_id', q.clientId);
    if (q.status === 'active') query = query.eq('is_active', true);
    if (q.status === 'inactive') query = query.eq('is_active', false);
    if (q.staleDays) {
      const cutoff = new Date(Date.now() - q.staleDays * 86_400_000).toISOString();
      query = query.or(`last_post_at.is.null,last_post_at.lt.${cutoff}`);
    }
    const [from, to] = pageRange(q.page, q.pageSize);
    const { data, error, count } = await query
      .order(q.sort, { ascending: q.dir === 'asc', nullsFirst: q.dir === 'asc' })
      .order('id')
      .range(from, to);
    if (error) throw dbError(error, 'Load locations');
    const body: Paginated<LocationDTO> = {
      items: ((data ?? []) as unknown as RawLocation[]).map(toLocationDTO),
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
    return c.json(body);
  })

  /** Compact list of every active location for pickers (compose, import review). */
  .get('/options', async (c) => {
    const rows = unwrap(
      await db()
        .from('locations')
        .select(LOCATION_SELECT)
        .eq('is_active', true)
        .order('title')
        .limit(5000),
      'Load locations',
    );
    return c.json((rows as unknown as RawLocation[]).map(toLocationDTO));
  })

  .get('/:id', async (c) => c.json(await loadLocation(c.req.param('id'))))

  .get('/:id/posts', async (c) => {
    const id = c.req.param('id');
    const q = parseQuery(c, paginationQuerySchema);
    const [from, to] = pageRange(q.page, q.pageSize);
    const { data, error, count } = await db()
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('location_id', id)
      .order('scheduled_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw dbError(error, 'Load posts');
    const body: Paginated<PostDTO> = {
      items: (data ?? []).map(toPostDTO),
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
    return c.json(body);
  })

  .patch('/:id', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, locationUpdateSchema);
    const before = await loadLocation(id);
    if (body.default_connection_id) await assertConnectionHasAccess(id, body.default_connection_id);
    const patch = body.timezone && body.timezone !== before.timezone ? { ...body, timezone_source: 'manual' as const } : body;
    unwrap(await db().from('locations').update(patch).eq('id', id), 'Update location');
    await logActivity({
      actor: c.get('user').id,
      action: 'location.updated',
      entityType: 'location',
      entityId: id,
      details: { title: before.title, changes: body },
    });
    return c.json(await loadLocation(id));
  })

  .post('/bulk', requireRole('manager'), async (c) => {
    const body = await parseBody(c, locationBulkSchema);
    const patch: { client_id?: string | null; is_active?: boolean; timezone?: string; timezone_source?: 'manual' } = {};
    if (body.client_id !== undefined) patch.client_id = body.client_id;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.timezone !== undefined) {
      patch.timezone = body.timezone;
      patch.timezone_source = 'manual';
    }
    let updated = 0;
    for (const ids of chunk(body.ids, 200)) {
      const rows = unwrap(
        await db().from('locations').update(patch).in('id', ids).select('id'),
        'Bulk update locations',
      );
      updated += rows.length;
    }
    await logActivity({
      actor: c.get('user').id,
      action: 'location.bulk_updated',
      entityType: 'location',
      details: { count: updated, changes: patch },
    });
    return c.json({ updated });
  })

  /** Imports the location's existing Google posts into our history as `published`. */
  .post('/:id/import-history', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const loc = await loadLocation(id);
    const candidates = loc.access.filter((a) => a.status === 'active');
    const preferred =
      candidates.find((a) => a.connection_id === loc.default_connection_id) ?? candidates[0];
    if (!preferred) {
      throw new ApiError(409, 'no_connection', 'No active Google account manages this location.');
    }
    let posts;
    try {
      const client = await GoogleClient.forConnection(preferred.connection_id);
      posts = await listLocalPosts(client, preferred.account_name, loc.location_name);
    } catch (err) {
      throw new ApiError(502, 'google_error', `Could not load posts from Google: ${googleErrorMessage(err)}`);
    }

    const names = posts.map((p) => p.name);
    const known = new Set<string>();
    for (const part of chunk(names, 200)) {
      const rows = unwrap(
        await db().from('posts').select('google_post_name').in('google_post_name', part),
        'Check existing posts',
      );
      rows.forEach((r) => r.google_post_name && known.add(r.google_post_name));
    }

    const fresh = posts.filter((p) => !known.has(p.name));
    const rows = fresh.map((p) => {
      const media = p.media?.[0];
      const topic: TopicType = p.topicType === 'EVENT' || p.topicType === 'OFFER' ? p.topicType : 'STANDARD';
      const schedule = p.event?.schedule;
      return {
        location_id: id,
        connection_id: preferred.connection_id,
        account_name: preferred.account_name,
        topic_type: topic,
        language_code: p.languageCode ?? 'en-US',
        summary: (p.summary ?? '').slice(0, 1500),
        cta_type: (p.callToAction?.actionType as CtaType | undefined) ?? null,
        cta_url: p.callToAction?.url ?? null,
        media_url: media?.googleUrl ?? media?.sourceUrl ?? null,
        image_source: media ? ('upload' as const) : ('none' as const),
        event_title: p.event?.title ?? null,
        event_start: fromGoogleDateTime(schedule?.startDate, schedule?.startTime, loc.timezone),
        event_end: fromGoogleDateTime(schedule?.endDate, schedule?.endTime, loc.timezone),
        offer_coupon_code: p.offer?.couponCode ?? null,
        offer_redeem_url: p.offer?.redeemOnlineUrl ?? null,
        offer_terms: p.offer?.termsConditions ?? null,
        status: 'published' as const,
        scheduled_at: p.createTime ?? null,
        published_at: p.createTime ?? null,
        google_post_name: p.name,
        google_search_url: p.searchUrl ?? null,
        last_error: p.state === 'REJECTED' ? 'Google rejected this post.' : null,
        created_by: 'google-import',
      };
    });
    for (const part of chunk(rows, 200)) {
      unwrap(await db().from('posts').insert(part), 'Save imported posts');
    }
    const latest = posts
      .map((p) => p.createTime)
      .filter((t): t is string => !!t)
      .sort()
      .at(-1);
    if (latest && (!loc.last_post_at || latest > loc.last_post_at)) {
      await db().from('locations').update({ last_post_at: latest }).eq('id', id);
    }
    const result: HistoryImportResult = { found: posts.length, imported: rows.length, skipped: posts.length - rows.length };
    await logActivity({
      actor: c.get('user').id,
      action: 'location.history_imported',
      entityType: 'location',
      entityId: id,
      details: { title: loc.title, ...result },
    });
    return c.json(result);
  });
