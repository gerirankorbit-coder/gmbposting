import type { ClientDTO, PostDTO } from '../../shared/types.js';
import type { ClientRow, PostRow } from './types.js';

export function toPostDTO(p: PostRow): PostDTO {
  return {
    id: p.id,
    campaign_id: p.campaign_id,
    import_id: p.import_id,
    location_id: p.location_id,
    connection_id: p.connection_id,
    account_name: p.account_name,
    image_source: p.image_source,
    image_library_id: p.image_library_id,
    branded_template: p.branded_template,
    topic_type: p.topic_type,
    summary: p.summary,
    cta_type: p.cta_type,
    cta_url: p.cta_url,
    media_url: p.media_url,
    event_title: p.event_title,
    event_start: p.event_start,
    event_end: p.event_end,
    offer_coupon_code: p.offer_coupon_code,
    offer_redeem_url: p.offer_redeem_url,
    offer_terms: p.offer_terms,
    status: p.status,
    scheduled_at: p.scheduled_at,
    published_at: p.published_at,
    google_post_name: p.google_post_name,
    google_search_url: p.google_search_url,
    attempts: p.attempts,
    next_attempt_at: p.next_attempt_at,
    last_error: p.last_error,
    review_note: p.review_note,
    created_by: p.created_by,
    approved_by: p.approved_by,
    approved_at: p.approved_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export function toClientDTO(c: ClientRow, locationCount = 0): ClientDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    is_active: c.is_active,
    brand_voice: c.brand_voice,
    default_cta_url: c.default_cta_url,
    notes: c.notes,
    logo_url: c.logo_url,
    brand_primary: c.brand_primary,
    brand_secondary: c.brand_secondary,
    brand_text_color: c.brand_text_color,
    tagline: c.tagline,
    preferred_templates: c.preferred_templates,
    on_library_exhausted: c.on_library_exhausted,
    low_stock_threshold: c.low_stock_threshold,
    stock_state: c.stock_state,
    location_count: locationCount,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

/** Reads `[{ count }]` produced by PostgREST embedded aggregate selects. */
export function embeddedCount(value: unknown): number {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object' && 'count' in value[0]) {
    return Number((value[0] as { count: number }).count) || 0;
  }
  return 0;
}
