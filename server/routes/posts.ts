import { Hono } from 'hono';
import {
  brandedRegenerateSchema,
  calendarQuerySchema,
  createPostsSchema,
  postIdsSchema,
  postListQuerySchema,
  postUpdateSchema,
  rejectPostsSchema,
  reschedulePostSchema,
} from '../../shared/schemas.js';
import { hasRole, type BulkActionResult, type CreatePostsResult, type PostStatus } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { chunk, dbError, unwrap, unwrapOne } from '../db/helpers.js';
import { getSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
import type { PostRow, UpdateOfTable } from '../db/types.js';
import { ApiError, badRequest, conflict, forbidden } from '../lib/errors.js';
import { parseBody, parseQuery } from '../lib/validate.js';
import { requireRole, type AuthEnv, type AuthUser } from '../middleware/auth.js';
import { GoogleClient, googleErrorMessage } from '../google/client.js';
import { GoogleApiError } from '../google/errors.js';
import { deleteLocalPost } from '../google/posts.js';
import { createPosts } from '../posts/create.js';
import { regenerateBranded } from '../images/resolve.js';
import { getPostItem, getPostRow, listPosts, POST_LIST_SELECT, toListItem } from '../posts/queries.js';

const LOCKED: PostStatus[] = ['publishing', 'published', 'cancelled'];

/** Writers may edit drafts and pending posts; approved/failed posts need a manager. */
function assertCanEdit(post: PostRow, user: AuthUser) {
  if (LOCKED.includes(post.status)) throw conflict(`A ${post.status} post can no longer be edited.`);
  if ((post.status === 'scheduled' || post.status === 'failed') && !hasRole(user.role, 'manager')) {
    throw forbidden('Only managers can edit approved posts.');
  }
}

/** Updates rows whose status is in `from`, returning how many changed. */
async function transition(
  ids: string[],
  from: PostStatus[],
  patch: UpdateOfTable<'posts'>,
): Promise<BulkActionResult> {
  let updated = 0;
  for (const part of chunk(ids, 200)) {
    const rows = unwrap(
      await db().from('posts').update(patch).in('id', part).in('status', from).select('id'),
      'Update posts',
    );
    updated += rows.length;
  }
  return { updated, skipped: ids.length - updated };
}

export const postRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => c.json(await listPosts(parseQuery(c, postListQuerySchema))))

  .get('/calendar', async (c) => {
    const q = parseQuery(c, calendarQuerySchema);
    let query = db()
      .from('posts')
      .select(POST_LIST_SELECT)
      .in('status', ['scheduled', 'publishing', 'published', 'failed', 'pending_approval'])
      .or(`and(scheduled_at.gte.${q.from},scheduled_at.lt.${q.to}),and(published_at.gte.${q.from},published_at.lt.${q.to})`)
      .order('scheduled_at', { ascending: true })
      .limit(3000);
    if (q.clientId) query = query.eq('location.client_id', q.clientId);
    const { data, error } = await query;
    if (error) throw dbError(error, 'Load calendar');
    return c.json(((data ?? []) as unknown as Parameters<typeof toListItem>[0][]).map(toListItem));
  })

  .get('/:id', async (c) => c.json(await getPostItem(c.req.param('id'))))

  .post('/', async (c) => {
    const user = c.get('user');
    const body = await parseBody(c, createPostsSchema);
    if (body.mode === 'approve' && !hasRole(user.role, 'manager')) {
      throw forbidden('Only managers and admins can approve and schedule posts.');
    }
    let campaignId: string | null = null;
    if (body.campaign) {
      const campaign = unwrapOne(
        await db()
          .from('campaigns')
          .insert({
            name: body.campaign.name,
            base_prompt: body.campaign.base_prompt,
            topic_type: body.posts[0]?.topic_type ?? null,
            created_by: user.id,
          })
          .select('id')
          .single(),
        'Create campaign',
      );
      campaignId = campaign.id;
    }
    let result;
    try {
      result = await createPosts({ posts: body.posts, mode: body.mode, repeatWeeks: body.repeatWeeks, actorId: user.id, campaignId });
    } catch (err) {
      if (campaignId) await db().from('campaigns').delete().eq('id', campaignId);
      throw err;
    }
    await logActivity({
      actor: user.id,
      action: body.mode === 'draft' ? 'posts.drafted' : body.mode === 'approve' ? 'posts.approved_and_scheduled' : 'posts.submitted',
      entityType: campaignId ? 'campaign' : 'post',
      entityId: campaignId ?? result.ids[0] ?? null,
      details: { count: result.ids.length, status: result.status, campaign: body.campaign?.name ?? null },
    });
    const dto: CreatePostsResult = { campaign_id: campaignId, created: result.ids.length, status: result.status, post_ids: result.ids };
    return c.json(dto, 201);
  })

  .patch('/:id', async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await parseBody(c, postUpdateSchema);
    const post = await getPostRow(id);
    assertCanEdit(post, user);

    const next = { ...post, ...body } as PostRow;
    const patch: UpdateOfTable<'posts'> = { ...body } as UpdateOfTable<'posts'>;
    if (body.cta_url === '') patch.cta_url = null;
    if (body.offer_redeem_url === '') patch.offer_redeem_url = null;

    if (body.connection_id && body.connection_id !== post.connection_id) {
      const access = unwrap(
        await db()
          .from('location_access')
          .select('account_name, connection:google_connections(status, email)')
          .eq('location_id', post.location_id)
          .eq('connection_id', body.connection_id)
          .maybeSingle(),
        'Check access',
      );
      if (!access) throw badRequest('That Gmail cannot manage this location.');
      if (access.connection?.status !== 'active') throw badRequest(`${access.connection?.email ?? 'That Gmail'} needs to be reconnected first.`);
      patch.account_name = access.account_name;
    }

    if (next.topic_type === 'STANDARD' && !next.summary.trim()) throw badRequest('The post text cannot be empty.');
    if (next.cta_type && next.cta_type !== 'CALL' && !(patch.cta_url ?? next.cta_url)) {
      const loc = unwrapOne(
        await db().from('locations').select('website_uri, client:clients(default_cta_url)').eq('id', post.location_id).maybeSingle(),
        'Location',
      );
      const fallback = loc.client?.default_cta_url ?? loc.website_uri;
      if (!fallback) throw badRequest('This button needs a link.');
      patch.cta_url = fallback;
    }
    if (next.cta_type === 'CALL' || next.cta_type === null) patch.cta_url = null;
    if (body.image_source === 'auto' || body.image_source === 'none') {
      patch.media_url = null;
      patch.media_path = null;
      patch.image_library_id = null;
    }
    if ((body.image_source === 'upload' || body.image_source === 'library' || body.image_source === 'branded') && !next.media_url) {
      throw badRequest('Choose an image first.');
    }
    if (next.topic_type !== 'STANDARD') {
      if (!next.event_title) throw badRequest('Add a title.');
      if (!next.event_start || !next.event_end) throw badRequest('Add a start and end date.');
      if (new Date(next.event_end) < new Date(next.event_start)) throw badRequest('The end must be after the start.');
    }

    unwrap(await db().from('posts').update(patch).eq('id', id).in('status', [post.status]), 'Update post');
    await logActivity({
      actor: user.id,
      action: 'post.edited',
      entityType: 'post',
      entityId: id,
      details: { fields: Object.keys(body) },
    });
    return c.json(await getPostItem(id));
  })

  .post('/submit', async (c) => {
    const { ids } = await parseBody(c, postIdsSchema);
    const settings = await getSettings();
    const user = c.get('user');
    const now = new Date().toISOString();
    // Drafts without a time publish as soon as they are approved.
    const result = settings.approval_required
      ? await transition(ids, ['draft'], { status: 'pending_approval', review_note: null })
      : await transition(ids, ['draft'], { status: 'scheduled', review_note: null, approved_by: user.id, approved_at: now });
    unwrap(
      await db().from('posts').update({ scheduled_at: now }).in('id', ids).is('scheduled_at', null).in('status', ['pending_approval', 'scheduled']),
      'Default schedule',
    );
    await logActivity({ actor: user.id, action: 'posts.submitted', entityType: 'post', details: { count: result.updated } });
    return c.json(result);
  })

  .post('/approve', requireRole('manager'), async (c) => {
    const { ids } = await parseBody(c, postIdsSchema);
    const user = c.get('user');
    const result = await transition(ids, ['pending_approval', 'draft'], {
      status: 'scheduled',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      review_note: null,
    });
    unwrap(
      await db().from('posts').update({ scheduled_at: new Date().toISOString() }).in('id', ids).is('scheduled_at', null).eq('status', 'scheduled'),
      'Default schedule',
    );
    await logActivity({ actor: user.id, action: 'posts.approved', entityType: 'post', details: { count: result.updated } });
    return c.json(result);
  })

  .post('/reject', requireRole('manager'), async (c) => {
    const { ids, note } = await parseBody(c, rejectPostsSchema);
    const result = await transition(ids, ['pending_approval', 'scheduled'], {
      status: 'draft',
      review_note: note,
      approved_by: null,
      approved_at: null,
    });
    await logActivity({ actor: c.get('user').id, action: 'posts.rejected', entityType: 'post', details: { count: result.updated, note } });
    return c.json(result);
  })

  .post('/cancel', requireRole('manager'), async (c) => {
    const { ids } = await parseBody(c, postIdsSchema);
    const result = await transition(ids, ['draft', 'pending_approval', 'scheduled', 'failed'], {
      status: 'cancelled',
      next_attempt_at: null,
    });
    await logActivity({ actor: c.get('user').id, action: 'posts.cancelled', entityType: 'post', details: { count: result.updated } });
    return c.json(result);
  })

  .post('/:id/reschedule', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const { scheduled_at } = await parseBody(c, reschedulePostSchema);
    const post = await getPostRow(id);
    if (!['draft', 'pending_approval', 'scheduled', 'failed'].includes(post.status)) {
      throw conflict(`A ${post.status} post cannot be rescheduled.`);
    }
    const patch: UpdateOfTable<'posts'> = { scheduled_at };
    if (post.status === 'failed') Object.assign(patch, { status: 'scheduled', attempts: 0, next_attempt_at: null, last_error: null });
    unwrap(await db().from('posts').update(patch).eq('id', id).eq('status', post.status), 'Reschedule');
    await logActivity({
      actor: c.get('user').id,
      action: 'post.rescheduled',
      entityType: 'post',
      entityId: id,
      details: { from: post.scheduled_at, to: scheduled_at },
    });
    return c.json(await getPostItem(id));
  })

  .post('/:id/retry', requireRole('manager'), async (c) => {
    const id = c.req.param('id');
    const result = await transition([id], ['failed'], {
      status: 'scheduled',
      scheduled_at: new Date().toISOString(),
      attempts: 0,
      next_attempt_at: null,
      last_error: null,
      locked_at: null,
    });
    if (!result.updated) throw conflict('Only failed posts can be retried.');
    await logActivity({ actor: c.get('user').id, action: 'post.retry_requested', entityType: 'post', entityId: id });
    return c.json(await getPostItem(id));
  })

  /** Deletes a published post on Google and marks it cancelled (admin only). */
  .post('/:id/delete-from-google', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    const post = await getPostRow(id);
    if (post.status !== 'published' || !post.google_post_name) throw conflict('Only published posts can be deleted from Google.');
    if (!post.connection_id) throw conflict('This post has no Google account to delete it with.');
    try {
      const client = await GoogleClient.forConnection(post.connection_id);
      await deleteLocalPost(client, post.google_post_name);
    } catch (err) {
      if (!(err instanceof GoogleApiError && err.status === 404)) {
        throw new ApiError(502, 'google_error', `Google did not delete the post: ${googleErrorMessage(err)}`);
      }
    }
    unwrap(
      await db().from('posts').update({ status: 'cancelled', google_search_url: null, review_note: 'Deleted from Google' }).eq('id', id),
      'Update post',
    );
    await logActivity({
      actor: c.get('user').id,
      action: 'post.deleted_from_google',
      entityType: 'post',
      entityId: id,
      details: { google_post_name: post.google_post_name },
    });
    return c.json(await getPostItem(id));
  })

  /** Generates (or regenerates) a branded graphic for a post that has not been published. */
  .post('/:id/branded', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    const { template } = await parseBody(c, brandedRegenerateSchema);
    const post = await getPostRow(id);
    if (LOCKED.includes(post.status)) throw conflict(`A ${post.status} post cannot get a new image.`);
    try {
      await regenerateBranded(post, template);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'Could not generate the graphic.');
    }
    await logActivity({ actor: c.get('user').id, action: 'post.branded_generated', entityType: 'post', entityId: id, details: { template: template ?? 'auto' } });
    return c.json(await getPostItem(id));
  })

  /** Permanently removes posts that never went live (drafts and cancelled). */
  .post('/delete', async (c) => {
    const { ids } = await parseBody(c, postIdsSchema);
    const user = c.get('user');
    const allowed: PostStatus[] = hasRole(user.role, 'manager') ? ['draft', 'cancelled', 'pending_approval'] : ['draft'];
    let deleted = 0;
    for (const part of chunk(ids, 200)) {
      let q = db().from('posts').delete().in('id', part).in('status', allowed).is('google_post_name', null);
      if (!hasRole(user.role, 'manager')) q = q.eq('created_by', user.id);
      deleted += unwrap(await q.select('id'), 'Delete posts').length;
    }
    await logActivity({ actor: user.id, action: 'posts.deleted', entityType: 'post', details: { count: deleted } });
    return c.json({ updated: deleted, skipped: ids.length - deleted } satisfies BulkActionResult);
  });
