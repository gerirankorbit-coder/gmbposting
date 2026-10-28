import { formatDistanceToNowStrict } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** e.g. "Nov 3, 2026, 9:30 AM" in the given timezone. */
export function formatInZone(iso: string | null | undefined, timeZone: string, pattern = 'MMM d, yyyy, h:mm a'): string {
  if (!iso) return '—';
  try {
    return formatInTimeZone(new Date(iso), timeZone, pattern);
  } catch {
    return formatInTimeZone(new Date(iso), 'UTC', pattern);
  }
}

export function formatLocal(iso: string | null | undefined, pattern = 'MMM d, yyyy, h:mm a'): string {
  return formatInZone(iso, browserTimeZone(), pattern);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function initials(text: string | null | undefined): string {
  if (!text) return '?';
  const parts = text.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

let zones: string[] | null = null;
export function allTimeZones(): string[] {
  if (zones) return zones;
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  zones = intl.supportedValuesOf?.('timeZone') ?? ['UTC', 'Asia/Karachi', 'America/New_York', 'Europe/London'];
  if (!zones.includes('UTC')) zones = ['UTC', ...zones];
  return zones;
}
