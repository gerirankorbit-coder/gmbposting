import { postingBlockReason } from '../../shared/posting.js';
import { contentFingerprint, contentWarnings } from '../../shared/content.js';
import {
  parseCtaType,
  parseDate,
  parseDateTime,
  parsePostType,
  parseTime,
  type ImportRawRow,
} from '../../shared/import.js';
import { zonedWallToUtc } from '../../shared/schedule.js';
import { POST_SUMMARY_MAX, type ImportCandidate, type ImportRowResolved, type ImportRowStatus } from '../../shared/types.js';
import { matchBusiness, normalizeName } from './match.js';
import type { CtxLocation, MatchContext } from './context.js';

export interface ValidatedRow {
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  matched_location_id: string | null;
  matched_connection_id: string | null;
  match_confidence: number | null;
  candidates: ImportCandidate[];
  resolved: ImportRowResolved;
}

const isHttpUrl = (v: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v);

/** Normalises "16873303394162985942" / "locations/1687…" / "accounts/1/locations/1687…" to locations/<id>. */
export function toLocationName(v: string): string | null {
  const m = v.trim().match(/(?:^|locations\/)(\d{5,})$/);
  return m ? `locations/${m[1]}` : null;
}

function emptyResolved(raw: ImportRawRow): ImportRowResolved {
  return {
    content: (raw.post_content ?? '').trim(),
    topic_type: 'STANDARD',
    cta_type: null,
    cta_url: null,
    scheduled_at: null,
    event_title: null,
    event_start: null,
    event_end: null,
    coupon_code: null,
    offer_terms: null,
    redeem_url: null,
    image: { kind: 'auto', ref: null, status: 'ready', url: null, path: null },
    timezone: null,
    location_title: null,
    location_city: null,
    client_name: null,
    gmail: raw.gmail?.trim().toLowerCase() ?? null,
  };
}

/** Finds which other connected Gmails can manage a business with this name. */
function otherGmailsFor(raw: ImportRawRow, ctx: MatchContext, exceptId: string | null): string[] {
  const name = normalizeName(raw.business_name ?? '');
  if (!name) return [];
  const out: string[] = [];
  for (const conn of ctx.connectionsById.values()) {
    if (conn.id === exceptId || conn.status === 'revoked') continue;
    const r = matchBusiness(raw.business_name!, raw.city, ctx.poolFor(conn.id));
    if (r.kind !== 'none') out.push(conn.email);
  }
  return out.slice(0, 3);
}

/**
 * Validates one spreadsheet row: Gmail, business match, content, post type, button, schedule,
 * offer/event fields and image reference. `previousImage` keeps already-processed images.
 */
export function validateRow(
  raw: ImportRawRow,
  ctx: MatchContext,
  previousImage?: ImportRowResolved['image'] | null,
): ValidatedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved = emptyResolved(raw);
  let candidates: ImportCandidate[] = [];
  let status: ImportRowStatus = 'ok';
  let location: CtxLocation | null = null;
  let confidence: number | null = null;

  // --- Gmail ---------------------------------------------------------------------------------
  const email = raw.gmail?.trim().toLowerCase();
  const conn = email ? ctx.connectionsByEmail.get(email) : undefined;
  if (!email) errors.push('Gmail is missing.');
  else if (!conn) errors.push(`${email} is not a connected Google account.`);
  else if (conn.status === 'needs_reauth') errors.push(`${email} needs to be reconnected on the Connections page.`);
  else if (conn.status === 'revoked') errors.push(`${email} was disconnected.`);

  // --- Business --------------------------------------------------------------------------------
  const business = raw.business_name?.trim();
  if (!business && !raw.location_id) errors.push('Business name is missing.');
  if (conn && conn.status === 'active') {
    if (raw.location_id) {
      const name = toLocationName(raw.location_id);
      const loc = name ? ctx.byLocationName.get(name) : undefined;
      if (!name) errors.push(`location_id "${raw.location_id}" is not a valid Google location ID.`);
      else if (!loc) errors.push(`Location ${raw.location_id} has not been synced. Run a sync on the Connections page.`);
      else if (!conn.access.has(loc.id)) {
        const others = [...ctx.connectionsById.values()].filter((c) => c.access.has(loc.id)).map((c) => c.email);
        errors.push(`${email} cannot manage ${loc.title}.${others.length ? ` It is available under ${others.join(', ')}.` : ''}`);
      } else {
        location = loc;
        confidence = 1;
      }
    } else if (business) {
      const result = matchBusiness(business, raw.city, ctx.poolFor(conn.id));
      if (result.kind === 'match') {
        location = ctx.locations.get(result.location.id)!;
        confidence = result.confidence;
        if (result.viaFuzzy) warnings.push(`Matched "${business}" to "${location.title}" by similar name.`);
      } else if (result.kind === 'review') {
        status = 'needs_review';
        candidates = result.candidates;
        warnings.push(result.reason);
      } else {
        const others = otherGmailsFor(raw, ctx, conn.id);
        errors.push(
          `Business not found under this Gmail.${others.length ? ` It exists under ${others.join(', ')}.` : ' Check the name or sync the account.'}`,
        );
      }
    }
  }
  if (location) {
    const blocked = postingBlockReason({
      title: location.title,
      is_active: location.is_active,
      google_verified: location.google_verified,
      client: location.client_name ? { name: location.client_name, is_active: location.client_active } : null,
    });
    if (blocked) errors.push(blocked);
  }
  if (location) {
    resolved.timezone = location.timezone;
    resolved.location_title = location.title;
    resolved.location_city = location.city;
    resolved.client_name = location.client_name;
  }

  // --- Content -----------------------------------------------------------------------------------
  const topic = parsePostType(raw.post_type);
  if (!topic) errors.push(`post_type "${raw.post_type}" is not valid. Use update, offer or event.`);
  else resolved.topic_type = topic;
  if (!resolved.content) errors.push('Post content is empty.');
  else if (resolved.content.length > POST_SUMMARY_MAX) {
    errors.push(`Post content is ${resolved.content.length} characters; the limit is ${POST_SUMMARY_MAX}.`);
  }
  warnings.push(...contentWarnings(resolved.content));

  // --- Button --------------------------------------------------------------------------------------
  const cta = parseCtaType(raw.cta_type);
  const ctaUrl = raw.cta_url?.trim() ?? '';
  if (cta === undefined) errors.push(`cta_type "${raw.cta_type}" is not valid. Use learn_more, book, order, shop, sign_up, call or none.`);
  else {
    // No button type given: default to "Learn more" when a link is available.
    const isNone = ['none', 'no', 'no button'].includes((raw.cta_type ?? '').trim().toLowerCase());
    resolved.cta_type = cta ?? (isNone ? null : 'LEARN_MORE');
    if (ctaUrl && !isHttpUrl(ctaUrl)) errors.push(`cta_url "${ctaUrl}" must start with http:// or https://.`);
    if (resolved.cta_type && resolved.cta_type !== 'CALL') {
      resolved.cta_url = ctaUrl || location?.default_cta_url || location?.website_uri || null;
      if (!resolved.cta_url) {
        if (cta) errors.push('This button needs a link: add cta_url, a client default link, or a website on the location.');
        else resolved.cta_type = null;
      }
    }
  }

  // --- Schedule -----------------------------------------------------------------------------------
  const date = raw.schedule_date ? parseDate(raw.schedule_date) : null;
  const time = raw.schedule_time ? parseTime(raw.schedule_time) : null;
  if (raw.schedule_date && !date) errors.push(`schedule_date "${raw.schedule_date}" must be YYYY-MM-DD.`);
  if (raw.schedule_time && !time) errors.push(`schedule_time "${raw.schedule_time}" must be HH:mm.`);
  if (time && !raw.schedule_date) warnings.push('schedule_time is ignored without a schedule_date.');
  if (date && location) {
    resolved.scheduled_at = zonedWallToUtc(date, time ?? '10:00', location.timezone);
    if (new Date(resolved.scheduled_at) < new Date()) warnings.push('The scheduled time is in the past; the post will publish as soon as possible.');
  }

  // --- Offer / event ---------------------------------------------------------------------------
  if (resolved.topic_type !== 'STANDARD') {
    const label = resolved.topic_type === 'OFFER' ? 'Offer' : 'Event';
    resolved.event_title = raw.event_title?.trim() || null;
    if (!resolved.event_title) errors.push(`${label} posts need an event_title.`);
    else if (resolved.event_title.length > 58) errors.push('event_title must be 58 characters or fewer.');
    const start = parseDateTime(raw.start_datetime);
    const end = parseDateTime(raw.end_datetime);
    if (!raw.start_datetime || !raw.end_datetime) errors.push(`${label} posts need start_datetime and end_datetime.`);
    else if (!start || !end) errors.push('start_datetime and end_datetime must be YYYY-MM-DD or YYYY-MM-DD HH:mm.');
    else if (location) {
      resolved.event_start = zonedWallToUtc(start.date, start.time ?? '00:00', location.timezone);
      resolved.event_end = zonedWallToUtc(end.date, end.time ?? '23:59', location.timezone);
      if (resolved.event_end < resolved.event_start) errors.push('end_datetime must be after start_datetime.');
    }
    if (resolved.topic_type === 'OFFER') {
      resolved.coupon_code = raw.coupon_code?.trim().slice(0, 58) || null;
      resolved.offer_terms = raw.offer_terms?.trim() || null;
      const redeem = raw.redeem_url?.trim();
      if (redeem && !isHttpUrl(redeem)) errors.push('redeem_url must start with http:// or https://.');
      else resolved.redeem_url = redeem || null;
    }
  }

  // --- Image -----------------------------------------------------------------------------------------
  const ref = raw.image?.trim() ?? '';
  if (!ref) resolved.image = { kind: 'auto', ref: null, status: 'ready', url: null, path: null };
  else if (['none', 'no', 'no image'].includes(ref.toLowerCase())) resolved.image = { kind: 'none', ref, status: 'ready', url: null, path: null };
  else if (previousImage && previousImage.ref === ref && previousImage.kind !== 'auto') resolved.image = previousImage;
  else if (isHttpUrl(ref)) resolved.image = { kind: 'url', ref, status: 'pending', url: null, path: null };
  else resolved.image = { kind: 'file', ref, status: 'pending', url: null, path: null };
  if (resolved.image.status === 'failed') warnings.push(`Image could not be used (${resolved.image.error ?? 'unknown error'}); Auto will be used instead.`);

  if (errors.length) status = 'error';
  return {
    status,
    errors,
    warnings,
    matched_location_id: location?.id ?? null,
    matched_connection_id: conn?.id ?? null,
    match_confidence: confidence,
    candidates,
    resolved,
  };
}

/** Adds "duplicate content" warnings for the same business within one import. */
export function flagDuplicates(rows: { row_number: number; v: ValidatedRow }[]): void {
  const seen = new Map<string, number>();
  for (const { row_number, v } of rows) {
    if (!v.matched_location_id || !v.resolved.content) continue;
    const key = `${v.matched_location_id}:${contentFingerprint(v.resolved.content)}`;
    const first = seen.get(key);
    if (first !== undefined) v.warnings.push(`Same text as row ${first} for this business.`);
    else seen.set(key, row_number);
  }
}
