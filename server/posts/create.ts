import type { PostDraft, PostSubmitMode } from '../../shared/schemas.js';
import type { PostStatus } from '../../shared/types.js';
import { chunk, unwrap } from '../db/helpers.js';
import { getSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
import type { InsertOfTable } from '../db/types.js';
import { ApiError, badRequest } from '../lib/errors.js';

const WEEK_MS = 7 * 86_400_000;

export interface CreatePostsOptions {
  posts: PostDraft[];
  mode: PostSubmitMode;
  repeatWeeks: number;
  actorId: string;
  campaignId: string | null;
  importId?: string | null;
  /** Import rows mark images that came from the spreadsheet as `sheet`. */
  imageSourceOverride?: 'sheet';
}

export function statusForMode(mode: PostSubmitMode, approvalRequired: boolean): PostStatus {
  if (mode === 'draft') return 'draft';
  if (mode === 'approve' || mode === 'publish_now') return 'scheduled';
  return approvalRequired ? 'pending_approval' : 'scheduled';
}

function shift(iso: string | null, weeks: number): string | null {
  return iso ? new Date(new Date(iso).getTime() + weeks * WEEK_MS).toISOString() : null;
}

interface LocationInfo {
  title: string;
  website_uri: string | null;
  is_active: boolean;
  client_id: string | null;
  default_cta_url: string | null;
}

/**
 * Validates access for every (location, Gmail) pair, fills CTA link fallbacks (client default,
 * then website), and inserts the posts plus weekly repeats. Returns the new post ids.
 */
export async function createPosts(opts: CreatePostsOptions): Promise<{ ids: string[]; status: PostStatus }> {
  const settings = await getSettings();
  const status = statusForMode(opts.mode, settings.approval_required);
  const locationIds = [...new Set(opts.posts.map((p) => p.location_id))];

  const locations = new Map<string, LocationInfo>();
  const access = new Map<string, { account_name: string; status: string; email: string }>();
  for (const ids of chunk(locationIds, 200)) {
    const rows = unwrap(
      await db()
        .from('locations')
        .select(
          'id, title, website_uri, is_active, client_id, client:clients(default_cta_url), access:location_access(connection_id, account_name, connection:google_connections(status, email))',
        )
        .in('id', ids),
      'Load locations',
    );
    for (const r of rows) {
      locations.set(r.id, {
        title: r.title,
        website_uri: r.website_uri,
        is_active: r.is_active,
        client_id: r.client_id,
        default_cta_url: r.client?.default_cta_url ?? null,
      });
      for (const a of r.access) {
        access.set(`${r.id}:${a.connection_id}`, {
          account_name: a.account_name,
          status: a.connection?.status ?? 'revoked',
          email: a.connection?.email ?? 'unknown',
        });
      }
    }
  }

  const libraryIds = [...new Set(opts.posts.map((p) => p.image_library_id).filter((v): v is string => !!v))];
  const library = new Map<string, { client_id: string; public_url: string; storage_path: string; used_count: number }>();
  if (libraryIds.length) {
    const rows = unwrap(
      await db()
        .from('image_library')
        .select('id, client_id, public_url, storage_path, used_count')
        .in('id', libraryIds)
        .eq('is_active', true),
      'Load library images',
    );
    rows.forEach((r) => library.set(r.id, r));
  }

  const now = new Date().toISOString();
  const approved = opts.mode === 'approve' || opts.mode === 'publish_now';
  const rows: InsertOfTable<'posts'>[] = [];
  opts.posts.forEach((p, index) => {
    const label = opts.posts.length > 1 ? `Post ${index + 1}: ` : '';
    const loc = locations.get(p.location_id);
    if (!loc) throw badRequest(`${label}the location no longer exists.`);
    if (!loc.is_active) throw badRequest(`${label}${loc.title} is inactive.`);
    const acc = access.get(`${p.location_id}:${p.connection_id}`);
    if (!acc) throw badRequest(`${label}the chosen Gmail cannot manage ${loc.title}.`);
    if (acc.status !== 'active' && opts.mode !== 'draft') {
      throw new ApiError(409, 'needs_reauth', `${label}${acc.email} must be reconnected before scheduling posts for ${loc.title}.`);
    }

    let ctaUrl = p.cta_url;
    if (p.cta_type && p.cta_type !== 'CALL' && !ctaUrl) ctaUrl = loc.default_cta_url ?? loc.website_uri;
    if (p.cta_type && p.cta_type !== 'CALL' && !ctaUrl) {
      throw badRequest(`${label}add a button link for ${loc.title} (it has no default link or website).`);
    }
    if (p.cta_type === 'CALL' || !p.cta_type) ctaUrl = null;

    let mediaUrl = p.media_url;
    let mediaPath = p.media_path;
    if (p.image_source === 'library') {
      const img = p.image_library_id ? library.get(p.image_library_id) : undefined;
      if (!img || img.client_id !== loc.client_id) {
        throw badRequest(`${label}the chosen library image is not available for ${loc.title}.`);
      }
      mediaUrl = img.public_url;
      mediaPath = img.storage_path;
    }
    if (p.image_source === 'auto' || p.image_source === 'none') {
      mediaUrl = null;
      mediaPath = null;
    }

    const scheduledAt = p.scheduled_at ?? (status === 'draft' ? null : now);
    const isEventLike = p.topic_type !== 'STANDARD';
    for (let week = 0; week < opts.repeatWeeks; week++) {
      rows.push({
        campaign_id: opts.campaignId,
        import_id: opts.importId ?? null,
        location_id: p.location_id,
        connection_id: p.connection_id,
        account_name: acc.account_name,
        image_source: opts.imageSourceOverride && mediaUrl ? opts.imageSourceOverride : p.image_source,
        image_library_id: p.image_source === 'library' ? p.image_library_id : null,
        topic_type: p.topic_type,
        summary: p.summary,
        cta_type: p.cta_type,
        cta_url: ctaUrl,
        media_url: mediaUrl,
        media_path: mediaPath,
        event_title: isEventLike ? p.event_title : null,
        event_start: isEventLike ? shift(p.event_start, week) : null,
        event_end: isEventLike ? shift(p.event_end, week) : null,
        offer_coupon_code: p.topic_type === 'OFFER' ? p.offer_coupon_code : null,
        offer_redeem_url: p.topic_type === 'OFFER' ? p.offer_redeem_url : null,
        offer_terms: p.topic_type === 'OFFER' ? p.offer_terms : null,
        status,
        scheduled_at: shift(scheduledAt, week),
        created_by: opts.actorId,
        approved_by: approved ? opts.actorId : null,
        approved_at: approved ? now : null,
      });
    }
  });

  const ids: string[] = [];
  for (const part of chunk(rows, 200)) {
    const inserted = unwrap(await db().from('posts').insert(part).select('id'), 'Create posts');
    ids.push(...inserted.map((r) => r.id));
  }

  // A specifically chosen library image counts as used.
  for (const [id, img] of library) {
    const uses = rows.filter((r) => r.image_library_id === id).length;
    await db()
      .from('image_library')
      .update({ used_count: img.used_count + uses, last_used_at: now })
      .eq('id', id);
  }
  return { ids, status };
}
