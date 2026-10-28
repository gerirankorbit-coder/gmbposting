import type { CtaType, TopicType } from '../../shared/types.js';
import type { GoogleClient } from './client.js';

const BASE = 'https://mybusiness.googleapis.com/v4';

interface GoogleDate {
  year: number;
  month: number;
  day: number;
}
interface GoogleTime {
  hours: number;
  minutes: number;
  seconds?: number;
  nanos?: number;
}

export interface LocalPostBody {
  languageCode: string;
  topicType: TopicType;
  summary: string;
  callToAction?: { actionType: CtaType; url?: string };
  media?: Array<{ mediaFormat: 'PHOTO'; sourceUrl: string }>;
  event?: {
    title: string;
    schedule: { startDate: GoogleDate; startTime?: GoogleTime; endDate: GoogleDate; endTime?: GoogleTime };
  };
  offer?: { couponCode?: string; redeemOnlineUrl?: string; termsConditions?: string };
}

export interface LocalPost extends Partial<LocalPostBody> {
  name: string; // accounts/1/locations/2/localPosts/3
  state?: 'LOCAL_POST_STATE_UNSPECIFIED' | 'REJECTED' | 'LIVE' | 'PROCESSING';
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
  media?: Array<{ mediaFormat: 'PHOTO'; sourceUrl: string; googleUrl?: string }>;
}

function postsPath(accountName: string, locationName: string): string {
  return `${BASE}/${accountName}/${locationName}/localPosts`;
}

export function createLocalPost(
  client: GoogleClient,
  accountName: string,
  locationName: string,
  body: LocalPostBody,
): Promise<LocalPost> {
  return client.request<LocalPost>(postsPath(accountName, locationName), { method: 'POST', json: body });
}

export function listLocalPosts(
  client: GoogleClient,
  accountName: string,
  locationName: string,
): Promise<LocalPost[]> {
  return client.paginate<LocalPost>(postsPath(accountName, locationName), 'localPosts', { pageSize: 100 });
}

export async function deleteLocalPost(client: GoogleClient, postName: string): Promise<void> {
  await client.request(`${BASE}/${postName}`, { method: 'DELETE' });
}

/** Converts a UTC instant to Google date/time objects in the given IANA timezone. */
export function toGoogleDateTime(iso: string, timeZone: string): { date: GoogleDate; time: GoogleTime } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    date: { year: get('year'), month: get('month'), day: get('day') },
    time: { hours: get('hour'), minutes: get('minute') },
  };
}

/** Converts Google date/time objects (location-local) back to an ISO string in UTC. */
export function fromGoogleDateTime(
  date: GoogleDate | undefined,
  time: GoogleTime | undefined,
  timeZone: string,
): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  const naiveUtc = Date.UTC(date.year, date.month - 1, date.day, time?.hours ?? 0, time?.minutes ?? 0);
  // Find the timezone offset at that wall-clock time and correct for it.
  const asLocal = toGoogleDateTime(new Date(naiveUtc).toISOString(), timeZone);
  const localUtc = Date.UTC(
    asLocal.date.year,
    asLocal.date.month - 1,
    asLocal.date.day,
    asLocal.time.hours,
    asLocal.time.minutes,
  );
  return new Date(naiveUtc - (localUtc - naiveUtc)).toISOString();
}
