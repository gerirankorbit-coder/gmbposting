import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

/** Converts a wall-clock date (yyyy-MM-dd) and time (HH:mm) in `timeZone` to a UTC ISO string. */
export function zonedWallToUtc(date: string, time: string, timeZone: string): string {
  return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, timeZone).toISOString();
}

export interface SpreadItem {
  /** Usually the location id; items with the same key never share a day when avoidable. */
  key: string;
  timeZone: string;
}

export interface SpreadOptions {
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  startHour: number; // 0-23
  endHour: number; // 1-24, exclusive
}

export function listDates(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const days = Math.max(0, differenceInCalendarDays(parseISO(endDate), start)) + 1;
  return Array.from({ length: days }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

/**
 * Evenly distributes items across the date range and, within each day, across the hour window
 * (in each item's own time zone). Times are rounded to 5 minutes. Returns ISO strings in input order.
 */
export function spreadSchedule(items: SpreadItem[], opts: SpreadOptions): string[] {
  const dates = listDates(opts.startDate, opts.endDate);
  const D = dates.length;
  const n = items.length;
  if (!n) return [];
  const dayOf: number[] = new Array(n);
  const used = new Map<string, Set<number>>();
  items.forEach((item, i) => {
    const taken = used.get(item.key) ?? new Set<number>();
    const target = Math.floor((i * D) / n);
    let day = target;
    for (let step = 0; step < D; step++) {
      const candidate = (target + step) % D;
      if (!taken.has(candidate)) {
        day = candidate;
        break;
      }
    }
    taken.add(day);
    used.set(item.key, taken);
    dayOf[i] = day;
  });

  const perDay = new Map<number, number[]>();
  dayOf.forEach((d, i) => perDay.set(d, [...(perDay.get(d) ?? []), i]));
  const startMin = Math.max(0, Math.min(23, opts.startHour)) * 60;
  const endMin = Math.max(startMin + 5, Math.min(24, opts.endHour) * 60);
  const out: string[] = new Array(n);
  for (const [day, indexes] of perDay) {
    indexes.forEach((itemIndex, j) => {
      const raw = startMin + ((endMin - startMin) * (j + 0.5)) / indexes.length;
      const minutes = Math.min(endMin - 5, Math.round(raw / 5) * 5);
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mm = String(minutes % 60).padStart(2, '0');
      out[itemIndex] = zonedWallToUtc(dates[day]!, `${hh}:${mm}`, items[itemIndex]!.timeZone);
    });
  }
  return out;
}
