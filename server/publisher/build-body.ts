import type { PostRow } from '../db/types.js';
import { toGoogleDateTime, type LocalPostBody } from '../google/posts.js';

/** Builds the v4 LocalPost request body. Empty callToAction/media are omitted. */
export function buildLocalPostBody(post: PostRow, timeZone: string): LocalPostBody {
  const body: LocalPostBody = {
    languageCode: post.language_code || 'en-US',
    topicType: post.topic_type,
    summary: post.summary,
  };
  if (post.cta_type) {
    body.callToAction = post.cta_type === 'CALL' ? { actionType: 'CALL' } : { actionType: post.cta_type, url: post.cta_url ?? undefined };
  }
  if (post.media_url) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.media_url }];
  if (post.topic_type !== 'STANDARD' && post.event_title && post.event_start && post.event_end) {
    const start = toGoogleDateTime(post.event_start, timeZone);
    const end = toGoogleDateTime(post.event_end, timeZone);
    body.event = {
      title: post.event_title,
      schedule: { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time },
    };
  }
  if (post.topic_type === 'OFFER') {
    const offer: NonNullable<LocalPostBody['offer']> = {};
    if (post.offer_coupon_code) offer.couponCode = post.offer_coupon_code;
    if (post.offer_redeem_url) offer.redeemOnlineUrl = post.offer_redeem_url;
    if (post.offer_terms) offer.termsConditions = post.offer_terms;
    body.offer = offer;
  }
  return body;
}
