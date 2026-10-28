import Fuse from 'fuse.js';
import type { ImportCandidate } from '../../shared/types.js';

const STOP_WORDS = new Set(['llc', 'inc', 'co', 'ltd', 'corp', 'corporation', 'company', 'the', 'pvt', 'private', 'limited', 'plc', 'llp', 'and', 'of']);

/** Lowercase, strip punctuation and legal suffixes ("BoxyPack, LLC" → "boxypack"). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

export function normalizeCity(city: string | null | undefined): string {
  return (city ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface MatchableLocation {
  id: string;
  title: string;
  city: string | null;
  address_text: string | null;
  service_area_text: string | null;
  norm: string;
}

function cityMatches(loc: MatchableLocation, city: string): boolean {
  const c = normalizeCity(city);
  if (!c) return false;
  return [loc.city, loc.address_text, loc.service_area_text].some((v) => normalizeCity(v).includes(c));
}

export type MatchResult =
  | { kind: 'match'; location: MatchableLocation; confidence: number; viaFuzzy: boolean }
  | { kind: 'review'; candidates: ImportCandidate[]; reason: string }
  | { kind: 'none' };

const CONFIDENT = 0.82;
const GAP = 0.08;

const toCandidate = (l: MatchableLocation, score: number): ImportCandidate => ({
  location_id: l.id,
  title: l.title,
  city: l.city,
  score: Math.round(score * 100) / 100,
});

/** Exact normalized match first, then fuzzy (fuse.js); `city` breaks ties. */
export function matchBusiness(name: string, city: string | undefined, pool: MatchableLocation[]): MatchResult {
  const target = normalizeName(name);
  if (!target || !pool.length) return { kind: 'none' };

  const exact = pool.filter((l) => l.norm === target);
  if (exact.length === 1) return { kind: 'match', location: exact[0]!, confidence: 1, viaFuzzy: false };
  if (exact.length > 1) {
    const byCity = city ? exact.filter((l) => cityMatches(l, city)) : [];
    if (byCity.length === 1) return { kind: 'match', location: byCity[0]!, confidence: 1, viaFuzzy: false };
    return {
      kind: 'review',
      candidates: (byCity.length ? byCity : exact).slice(0, 8).map((l) => toCandidate(l, 1)),
      reason: city ? `Several locations named "${name}" match ${city}.` : `Several locations are named "${name}". Add a city or pick one.`,
    };
  }

  const fuse = new Fuse(pool, { keys: ['norm'], includeScore: true, threshold: 0.45, ignoreLocation: true, minMatchCharLength: 2 });
  let results = fuse.search(target).map((r) => ({ loc: r.item, conf: 1 - (r.score ?? 1) }));
  if (!results.length) return { kind: 'none' };
  if (city) {
    const inCity = results.filter((r) => cityMatches(r.loc, city));
    if (inCity.length) results = inCity;
  }
  const [best, second] = results;
  if (best && best.conf >= CONFIDENT && (!second || best.conf - second.conf >= GAP)) {
    return { kind: 'match', location: best.loc, confidence: Math.round(best.conf * 100) / 100, viaFuzzy: true };
  }
  return {
    kind: 'review',
    candidates: results.slice(0, 8).map((r) => toCandidate(r.loc, r.conf)),
    reason: `"${name}" was not an exact match. Pick the right location.`,
  };
}
