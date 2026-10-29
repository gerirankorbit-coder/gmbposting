import { format } from 'date-fns';
import { contentWarnings } from '../../../shared/content';
import { postingBlockReason } from '../../../shared/posting';
import type { PostDraftInput } from '../../../shared/schemas';
import { spreadSchedule, zonedWallToUtc } from '../../../shared/schedule';
import { POST_SUMMARY_MAX, type CtaType, type LibraryImageDTO, type LocationDTO, type TopicType, type UploadedImageDTO } from '../../../shared/types';

export type ImageChoice = 'auto' | 'upload' | 'library' | 'none';
export type ContentMode = 'single' | 'ai' | 'import';
export type ScheduleMode = 'asap' | 'specific' | 'spread';

export interface ComposeState {
  selected: string[];
  connections: Record<string, string>;
  topicType: TopicType;
  ctaType: CtaType | 'NONE';
  ctaUrl: string;
  eventTitle: string;
  eventStartDate: string;
  eventStartTime: string;
  eventEndDate: string;
  eventEndTime: string;
  couponCode: string;
  redeemUrl: string;
  terms: string;
  imageChoice: ImageChoice;
  upload: UploadedImageDTO | null;
  libraryImage: LibraryImageDTO | null;
  contentMode: ContentMode;
  singleText: string;
  brief: string;
  tone: string;
  variations: Record<string, string>;
  /** Sheet the texts were taken from (content mode `import`). */
  importId: string | null;
  scheduleMode: ScheduleMode;
  specificDate: string;
  specificTime: string;
  spreadStart: string;
  spreadEnd: string;
  spreadFromHour: number;
  spreadToHour: number;
  repeatWeeks: number;
  campaignName: string;
}

export function initialComposeState(): ComposeState {
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextWeek = format(new Date(Date.now() + 6 * 86_400_000), 'yyyy-MM-dd');
  return {
    selected: [],
    connections: {},
    topicType: 'STANDARD',
    ctaType: 'LEARN_MORE',
    ctaUrl: '',
    eventTitle: '',
    eventStartDate: today,
    eventStartTime: '09:00',
    eventEndDate: nextWeek,
    eventEndTime: '18:00',
    couponCode: '',
    redeemUrl: '',
    terms: '',
    imageChoice: 'auto',
    upload: null,
    libraryImage: null,
    contentMode: 'single',
    singleText: '',
    brief: '',
    tone: 'friendly and professional',
    variations: {},
    importId: null,
    scheduleMode: 'asap',
    specificDate: format(new Date(Date.now() + 86_400_000), 'yyyy-MM-dd'),
    specificTime: '10:00',
    spreadStart: format(new Date(Date.now() + 86_400_000), 'yyyy-MM-dd'),
    spreadEnd: nextWeek,
    spreadFromHour: 9,
    spreadToHour: 18,
    repeatWeeks: 1,
    campaignName: '',
  };
}

/** The Gmail a location publishes with by default: its default connection, else first active. */
export function defaultConnectionFor(loc: LocationDTO): string | undefined {
  const active = loc.access.filter((a) => a.status === 'active');
  return (
    active.find((a) => a.connection_id === loc.default_connection_id)?.connection_id ??
    active[0]?.connection_id ??
    loc.access[0]?.connection_id
  );
}

export function summaryFor(state: ComposeState, locationId: string): string {
  return state.contentMode === 'single' ? state.singleText : (state.variations[locationId] ?? '');
}

export interface StepProblem {
  step: number;
  message: string;
}

/** Validation per wizard step (0-based). Returns the first problem, if any. */
export function validateCompose(state: ComposeState, locById: Map<string, LocationDTO>): StepProblem | null {
  if (!state.selected.length) return { step: 0, message: 'Select at least one location.' };
  for (const id of state.selected) {
    const loc = locById.get(id);
    if (!loc) return { step: 0, message: 'A selected location is no longer available.' };
    const blocked = postingBlockReason(loc);
    if (blocked) return { step: 0, message: `${blocked} Remove it from the selection.` };
    if (!state.connections[id]) return { step: 0, message: `Choose a Gmail for ${loc.title}.` };
  }
  if (state.topicType !== 'STANDARD') {
    if (!state.eventTitle.trim()) return { step: 1, message: 'Add a title for the event or offer.' };
    if (!state.eventStartDate || !state.eventEndDate) return { step: 1, message: 'Add start and end dates.' };
    if (`${state.eventEndDate}T${state.eventEndTime}` < `${state.eventStartDate}T${state.eventStartTime}`) {
      return { step: 1, message: 'The end must be after the start.' };
    }
  }
  if (state.ctaType !== 'NONE' && state.ctaType !== 'CALL' && state.ctaUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(state.ctaUrl.trim())) {
    return { step: 1, message: 'The button link must be a full URL starting with https://' };
  }
  if (state.imageChoice === 'upload' && !state.upload) return { step: 1, message: 'Upload an image or choose another image option.' };
  if (state.imageChoice === 'library') {
    if (!state.libraryImage) return { step: 1, message: 'Pick a library image or choose another image option.' };
    const clientIds = new Set(state.selected.map((id) => locById.get(id)?.client?.id ?? null));
    if (clientIds.size !== 1 || !clientIds.has(state.libraryImage.client_id)) {
      return { step: 1, message: 'Library images can only be used when every selected location belongs to the same client.' };
    }
  }
  for (const id of state.selected) {
    const text = summaryFor(state, id).trim();
    const title = locById.get(id)?.title ?? 'a location';
    if (!text && state.topicType === 'STANDARD') {
      const message =
        state.contentMode === 'single'
          ? 'Write the post text.'
          : state.contentMode === 'import'
            ? `The sheet has no post for ${title}; write it or pick another sheet.`
            : `Generate or write the post for ${title}.`;
      return { step: 2, message };
    }
    if (text.length > POST_SUMMARY_MAX) return { step: 2, message: `The post for ${title} is over ${POST_SUMMARY_MAX} characters.` };
  }
  if (state.scheduleMode === 'specific' && (!state.specificDate || !state.specificTime)) {
    return { step: 3, message: 'Pick a date and time.' };
  }
  if (state.scheduleMode === 'spread') {
    if (!state.spreadStart || !state.spreadEnd || state.spreadEnd < state.spreadStart) {
      return { step: 3, message: 'Pick a valid date range.' };
    }
    if (state.spreadToHour <= state.spreadFromHour) return { step: 3, message: 'The end hour must be after the start hour.' };
  }
  return null;
}

/** Locations whose CTA link will come from their client default or website. */
export function ctaFallbackFor(state: ComposeState, loc: LocationDTO, clientDefault: string | null): string | null {
  if (state.ctaType === 'NONE' || state.ctaType === 'CALL') return null;
  return state.ctaUrl.trim() || clientDefault || loc.website_uri || null;
}

export function contentWarningsFor(state: ComposeState, locationId: string): string[] {
  return contentWarnings(summaryFor(state, locationId));
}

/** Converts wizard state into API post drafts (one per selected location). */
export function buildDrafts(state: ComposeState, locById: Map<string, LocationDTO>): PostDraftInput[] {
  const locs = state.selected.map((id) => locById.get(id)!).filter(Boolean);
  let times: (string | null)[] = locs.map(() => null);
  if (state.scheduleMode === 'specific') {
    times = locs.map((l) => zonedWallToUtc(state.specificDate, state.specificTime, l.timezone));
  } else if (state.scheduleMode === 'spread') {
    times = spreadSchedule(
      locs.map((l) => ({ key: l.id, timeZone: l.timezone })),
      { startDate: state.spreadStart, endDate: state.spreadEnd, startHour: state.spreadFromHour, endHour: state.spreadToHour },
    );
  }
  const eventLike = state.topicType !== 'STANDARD';
  return locs.map((l, i) => ({
    location_id: l.id,
    connection_id: state.connections[l.id]!,
    topic_type: state.topicType,
    summary: summaryFor(state, l.id).trim(),
    cta_type: state.ctaType === 'NONE' ? null : state.ctaType,
    cta_url: state.ctaType === 'NONE' || state.ctaType === 'CALL' ? null : state.ctaUrl.trim() || null,
    image_source: state.imageChoice,
    media_url: state.imageChoice === 'upload' ? (state.upload?.url ?? null) : null,
    media_path: state.imageChoice === 'upload' ? (state.upload?.path ?? null) : null,
    image_library_id: state.imageChoice === 'library' ? (state.libraryImage?.id ?? null) : null,
    event_title: eventLike ? state.eventTitle.trim() : null,
    event_start: eventLike ? zonedWallToUtc(state.eventStartDate, state.eventStartTime, l.timezone) : null,
    event_end: eventLike ? zonedWallToUtc(state.eventEndDate, state.eventEndTime, l.timezone) : null,
    offer_coupon_code: state.topicType === 'OFFER' ? state.couponCode.trim() || null : null,
    offer_redeem_url: state.topicType === 'OFFER' ? state.redeemUrl.trim() || null : null,
    offer_terms: state.topicType === 'OFFER' ? state.terms.trim() || null : null,
    scheduled_at: times[i] ?? null,
  }));
}

export function defaultCampaignName(count: number): string {
  return `Compose – ${format(new Date(), 'MMM d, yyyy')} – ${count} location${count === 1 ? '' : 's'}`;
}
