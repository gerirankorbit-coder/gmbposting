import { postingBlockReason } from '../../shared/posting.js';
import { contentFingerprint } from '../../shared/content.js';
import type { PublisherSummary } from '../../shared/types.js';
import { logActivity, SYSTEM_ACTOR } from '../db/activity.js';
import { unwrap } from '../db/helpers.js';
import { getSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
import type { PostRow, UpdateOfTable } from '../db/types.js';
import { GoogleClient, googleErrorMessage } from '../google/client.js';
import { GoogleApiError, ReauthRequiredError } from '../google/errors.js';
import { createLocalPost, listLocalPosts, type LocalPost } from '../google/posts.js';
import { resolveAutoImage } from '../images/resolve.js';
import { notify } from '../notify/index.js';
import { buildLocalPostBody } from './build-body.js';

const MAX_ATTEMPTS = 3;
/** Wait before automatic retry number 1 and 2. */
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000];
/** Leave headroom under the 60 s function limit. */
const DEFAULT_TIME_BUDGET_MS = 50_000;
const INTERRUPTED_PREFIX = 'Publishing was interrupted';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class PermanentError extends Error {}

interface PublishContext {
  location: { id: string; title: string; location_name: string; timezone: string };
  client: GoogleClient;
  accountName: string;
}

async function loadContext(post: PostRow): Promise<PublishContext> {
  if (!post.connection_id) throw new PermanentError('No Google account is assigned to this post. Edit it and choose a Gmail.');
  const loc = unwrap(
    await db()
      .from('locations')
      .select('id, title, location_name, timezone, is_active, google_verified, client:clients(name, is_active)')
      .eq('id', post.location_id)
      .maybeSingle(),
    'Load location',
  );
  if (!loc) throw new PermanentError('The location no longer exists.');
  // Last line of defence: only switched-on, verified locations of active clients publish.
  const blocked = postingBlockReason(loc);
  if (blocked) throw new PermanentError(`${blocked} Then retry this post.`);
  const conn = unwrap(await db().from('google_connections').select('*').eq('id', post.connection_id).maybeSingle(), 'Load connection');
  if (!conn) throw new PermanentError('The Google account for this post was removed. Edit the post and choose another Gmail.');
  if (conn.status !== 'active') {
    throw new ReauthRequiredError(conn.id, `${conn.email} ${conn.status === 'revoked' ? 'was disconnected' : 'needs to be reconnected'}. Reconnect it or choose another Gmail.`);
  }
  const access = unwrap(
    await db().from('location_access').select('account_name').eq('location_id', loc.id).eq('connection_id', conn.id).maybeSingle(),
    'Check access',
  );
  if (!access) throw new PermanentError(`${conn.email} can no longer manage ${loc.title}. Sync the account or choose another Gmail.`);
  return { location: loc, client: GoogleClient.fromRow(conn), accountName: access.account_name };
}

/**
 * A run that died mid-publish may already have created the post on Google. Before retrying such
 * a post, look for a live post with the same text created recently and adopt it instead.
 */
async function findExistingOnGoogle(post: PostRow, ctx: PublishContext): Promise<LocalPost | null> {
  if (!post.last_error?.startsWith(INTERRUPTED_PREFIX)) return null;
  try {
    const recent = await listLocalPosts(ctx.client, ctx.accountName, ctx.location.location_name);
    const since = Date.now() - 2 * 86_400_000;
    const target = contentFingerprint(post.summary);
    return (
      recent.find((p) => p.summary && contentFingerprint(p.summary) === target && (!p.createTime || new Date(p.createTime).getTime() > since)) ?? null
    );
  } catch {
    return null;
  }
}

async function markPublished(post: PostRow, ctx: PublishContext, google: LocalPost, adopted: boolean) {
  const now = new Date().toISOString();
  unwrap(
    await db()
      .from('posts')
      .update({
        status: 'published',
        published_at: google.createTime ?? now,
        google_post_name: google.name,
        google_search_url: google.searchUrl ?? null,
        last_error: null,
        next_attempt_at: null,
        locked_at: null,
      })
      .eq('id', post.id),
    'Mark published',
  );
  await db().from('locations').update({ last_post_at: now }).eq('id', ctx.location.id);
  await logActivity({
    actor: SYSTEM_ACTOR,
    action: adopted ? 'post.published_recovered' : 'post.published',
    entityType: 'post',
    entityId: post.id,
    details: { location: ctx.location.title, google_post_name: google.name, state: google.state ?? null },
  });
}

async function markFailed(post: PostRow, message: string, permanent: boolean, locationTitle: string | null) {
  const attempts = post.attempts + 1;
  const final = permanent || attempts >= MAX_ATTEMPTS;
  const patch: UpdateOfTable<'posts'> = {
    status: 'failed',
    attempts: final ? Math.max(attempts, MAX_ATTEMPTS) : attempts,
    last_error: message.slice(0, 1000),
    next_attempt_at: final ? null : new Date(Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS.at(-1)!)).toISOString(),
    locked_at: null,
  };
  unwrap(await db().from('posts').update(patch).eq('id', post.id), 'Mark failed');
  await logActivity({
    actor: SYSTEM_ACTOR,
    action: final ? 'post.failed' : 'post.retry_scheduled',
    entityType: 'post',
    entityId: post.id,
    details: { location: locationTitle, attempt: attempts, error: message },
  });
  if (final) {
    await notify({
      type: 'post_failed',
      title: `Post failed for ${locationTitle ?? 'a location'}`,
      body: message,
      link: `/queue?status=failed`,
      dedupeKey: `post_failed:${post.id}`,
    });
  }
}

/** Publishes one claimed post. Returns true when it went live. */
async function publishOne(post: PostRow): Promise<boolean> {
  let ctx: PublishContext | null = null;
  try {
    ctx = await loadContext(post);
    const existing = await findExistingOnGoogle(post, ctx);
    if (existing) {
      await markPublished(post, ctx, existing, true);
      return true;
    }
    let current = post;
    if (post.image_source === 'auto') {
      try {
        const resolved = await resolveAutoImage(post);
        current = { ...post, ...resolved };
      } catch (err) {
        // Never block a post on its image: publish text-only and record why.
        console.error('[publisher] image resolution failed', post.id, err);
        await logActivity({ actor: SYSTEM_ACTOR, action: 'post.image_skipped', entityType: 'post', entityId: post.id, details: { error: err instanceof Error ? err.message : String(err) } });
        current = { ...post, media_url: null };
      }
    }
    const google = await createLocalPost(ctx.client, ctx.accountName, ctx.location.location_name, buildLocalPostBody(current, ctx.location.timezone));
    await markPublished(current, ctx, google, false);
    return true;
  } catch (err) {
    const message = googleErrorMessage(err);
    const transient =
      !(err instanceof PermanentError) &&
      !(err instanceof ReauthRequiredError) &&
      (!(err instanceof GoogleApiError) || err.status === 0 || err.status === 429 || err.status >= 500);
    await markFailed(post, message, !transient, ctx?.location.title ?? null);
    return false;
  }
}

/** Puts claimed-but-unprocessed posts back so the next run picks them up. */
async function release(posts: PostRow[]) {
  for (const p of posts) {
    await db()
      .from('posts')
      .update({ status: p.attempts > 0 ? 'failed' : 'scheduled', locked_at: null, next_attempt_at: p.attempts > 0 ? new Date().toISOString() : null })
      .eq('id', p.id)
      .eq('status', 'publishing');
  }
}

export async function runPublisher(opts: { actor: string; timeBudgetMs?: number } = { actor: SYSTEM_ACTOR }): Promise<PublisherSummary> {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const settings = await getSettings();
  const claimed = unwrap(
    await db().rpc('claim_due_posts', { p_limit: settings.max_posts_per_run, p_max_attempts: MAX_ATTEMPTS }),
    'Claim posts',
  );
  const summary: PublisherSummary = { processed: 0, published: 0, failed: 0, remaining: 0, started_at: new Date(started).toISOString(), duration_ms: 0 };

  for (const [i, post] of claimed.entries()) {
    // Each publish can take several seconds (image generation, Google API); stop early.
    if (Date.now() - started > budget - 8_000) {
      await release(claimed.slice(i));
      break;
    }
    const ok = await publishOne(post);
    summary.processed++;
    if (ok) summary.published++;
    else summary.failed++;
    const isLast = i === claimed.length - 1;
    if (!isLast && settings.publish_spacing_seconds > 0) {
      const wait = settings.publish_spacing_seconds * 1000;
      if (Date.now() - started + wait > budget - 8_000) {
        await release(claimed.slice(i + 1));
        break;
      }
      await sleep(wait);
    }
  }

  const now = new Date().toISOString();
  const [due, retry] = await Promise.all([
    db().from('posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').lte('scheduled_at', now),
    db().from('posts').select('id', { count: 'exact', head: true }).eq('status', 'failed').lt('attempts', MAX_ATTEMPTS).lte('next_attempt_at', now),
  ]);
  summary.remaining = (due.count ?? 0) + (retry.count ?? 0);
  summary.duration_ms = Date.now() - started;
  if (summary.processed || opts.actor !== SYSTEM_ACTOR) {
    await logActivity({ actor: opts.actor, action: 'publisher.run', entityType: 'publisher', details: { ...summary } });
  }
  return summary;
}
