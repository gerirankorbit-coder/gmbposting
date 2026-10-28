/** Spreadsheet import contract shared by the template generator, the browser parser and the server. */
import type { CtaType, TopicType } from './types.js';

export const IMPORT_COLUMNS = [
  'business_name',
  'gmail',
  'post_content',
  'city',
  'location_id',
  'schedule_date',
  'schedule_time',
  'post_type',
  'cta_type',
  'cta_url',
  'image',
  'event_title',
  'start_datetime',
  'end_datetime',
  'coupon_code',
  'offer_terms',
  'redeem_url',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRawRow = Partial<Record<ImportColumn, string>>;

export const IMPORT_MAX_ROWS = 2000;

export const COLUMN_DOCS: Record<ImportColumn, { required: boolean; description: string; allowed?: string }> = {
  business_name: { required: true, description: 'Business name as it appears on Google. Matched against the locations this Gmail can manage.' },
  gmail: { required: true, description: 'The connected Gmail that should publish this post. It must have access to the business.' },
  post_content: { required: true, description: 'The post text (max 1500 characters). Avoid phone numbers, emails and links; use the button instead.' },
  city: { required: false, description: 'Helps pick the right location when several have the same or a similar name.' },
  location_id: { required: false, description: 'Google location ID (e.g. 16873303394162985942 or locations/16873303394162985942). Overrides name matching.' },
  schedule_date: { required: false, description: 'Publish date in YYYY-MM-DD. Empty = use the option chosen on the preview screen (ASAP or spread).' },
  schedule_time: { required: false, description: "Publish time in HH:mm (24h), in the location's time zone. Defaults to 10:00 when only a date is given." },
  post_type: { required: false, description: 'Type of post.', allowed: 'update (default), offer, event' },
  cta_type: { required: false, description: 'Button on the post.', allowed: 'learn_more, book, order, shop, sign_up, call, none' },
  cta_url: { required: false, description: "Button link. Falls back to the client's default link, then the location's website." },
  image: { required: false, description: 'A direct image URL (Google Drive and Dropbox share links work), or the filename of an image uploaded with the sheet. Empty = Auto (library, then branded graphic).' },
  event_title: { required: false, description: 'Title for offer and event posts (max 58 characters). Required for offers and events.' },
  start_datetime: { required: false, description: 'Offer/event start: YYYY-MM-DD or YYYY-MM-DD HH:mm (location time). Required for offers and events.' },
  end_datetime: { required: false, description: 'Offer/event end: YYYY-MM-DD or YYYY-MM-DD HH:mm (location time). Required for offers and events.' },
  coupon_code: { required: false, description: 'Offer coupon code (offers only).' },
  offer_terms: { required: false, description: 'Offer terms and conditions (offers only).' },
  redeem_url: { required: false, description: 'Link to redeem the offer online (offers only).' },
};

const ALIASES: Record<string, ImportColumn> = {};
const addAliases = (col: ImportColumn, names: string[]) => [col, ...names].forEach((n) => (ALIASES[normalizeHeader(n)] = col));

export function normalizeHeader(h: string): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

addAliases('business_name', ['business', 'business name', 'name', 'company', 'company name', 'location', 'location name', 'profile', 'gbp', 'listing']);
addAliases('gmail', ['email', 'gmail account', 'google account', 'account', 'connection', 'publish with', 'gmail email']);
addAliases('post_content', ['content', 'post', 'text', 'post text', 'summary', 'message', 'body', 'description', 'copy']);
addAliases('city', ['town', 'area']);
addAliases('location_id', ['location id', 'gbp id', 'google location id', 'listing id']);
addAliases('schedule_date', ['date', 'publish date', 'post date', 'scheduled date', 'schedule']);
addAliases('schedule_time', ['time', 'publish time', 'post time', 'scheduled time']);
addAliases('post_type', ['type', 'topic', 'topic type', 'post type']);
addAliases('cta_type', ['cta', 'button', 'button type', 'call to action', 'cta button']);
addAliases('cta_url', ['url', 'link', 'cta link', 'button url', 'button link', 'landing page']);
addAliases('image', ['image url', 'photo', 'image file', 'picture', 'media', 'image name', 'photo url']);
addAliases('event_title', ['title', 'offer title', 'event name', 'offer name']);
addAliases('start_datetime', ['start', 'start date', 'event start', 'offer start', 'starts']);
addAliases('end_datetime', ['end', 'end date', 'event end', 'offer end', 'ends']);
addAliases('coupon_code', ['coupon', 'code', 'promo code', 'voucher']);
addAliases('offer_terms', ['terms', 'terms and conditions', 'conditions']);
addAliases('redeem_url', ['redeem link', 'redeem online url', 'redeem']);

export function columnForHeader(header: string): ImportColumn | null {
  return ALIASES[normalizeHeader(header)] ?? null;
}

/** Maps a row keyed by sheet headers to canonical columns (first matching header wins). */
export function mapRow(row: Record<string, unknown>): ImportRawRow {
  const out: ImportRawRow = {};
  for (const [header, value] of Object.entries(row)) {
    const col = columnForHeader(header);
    if (!col || out[col] !== undefined) continue;
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (text) out[col] = text;
  }
  return out;
}

export function isBlankRow(row: ImportRawRow): boolean {
  return Object.values(row).every((v) => !v || !String(v).trim());
}

// ---------------------------------------------------------------------------------------------
// Cell parsers
// ---------------------------------------------------------------------------------------------
export function parsePostType(v: string | undefined): TopicType | null {
  const n = normalizeHeader(v ?? '');
  if (!n || ['update', 'standard', 'whats new', 'what s new', 'news', 'post'].includes(n)) return 'STANDARD';
  if (['offer', 'deal', 'promo', 'promotion'].includes(n)) return 'OFFER';
  if (['event'].includes(n)) return 'EVENT';
  return null;
}

/** undefined = invalid value, null = no button. */
export function parseCtaType(v: string | undefined): CtaType | null | undefined {
  const n = normalizeHeader(v ?? '');
  if (!n) return null;
  const map: Record<string, CtaType | null> = {
    'learn more': 'LEARN_MORE',
    'learn': 'LEARN_MORE',
    'more': 'LEARN_MORE',
    'book': 'BOOK',
    'book now': 'BOOK',
    'order': 'ORDER',
    'order online': 'ORDER',
    'shop': 'SHOP',
    'buy': 'SHOP',
    'shop now': 'SHOP',
    'sign up': 'SIGN_UP',
    'signup': 'SIGN_UP',
    'call': 'CALL',
    'call now': 'CALL',
    'none': null,
    'no': null,
    'no button': null,
  };
  return n in map ? map[n] : undefined;
}

/** Accepts YYYY-MM-DD, YYYY/MM/DD and YYYY.MM.DD. Returns YYYY-MM-DD or null. */
export function parseDate(v: string | undefined): string | null {
  const m = (v ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Accepts HH:mm, H:mm, HH:mm:ss and 12-hour times like 9:30 am. Returns HH:mm or null. */
export function parseTime(v: string | undefined): string | null {
  const m = (v ?? '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === 'pm' ? 12 : 0);
  }
  if (h > 23 || min > 59 || (!m[2] && !m[3])) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" (also with T). Returns { date, time|null } or null. */
export function parseDateTime(v: string | undefined): { date: string; time: string | null } | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const [d, ...rest] = s.split(/[ T]+/);
  const date = parseDate(d);
  if (!date) return null;
  if (!rest.length) return { date, time: null };
  const time = parseTime(rest.join(' '));
  return time ? { date, time } : null;
}

/** Converts an Excel serial date/time (1900 system) to { date, time }. */
export function excelSerialToParts(serial: number): { date: string; time: string } {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// ---------------------------------------------------------------------------------------------
// Template content
// ---------------------------------------------------------------------------------------------
export const TEMPLATE_EXAMPLE_ROWS: ImportRawRow[] = [
  {
    business_name: 'BoxyPack',
    gmail: 'yourteam@gmail.com',
    post_content:
      'Holiday orders are coming in fast. Our team double-walls every custom mailer so gifts arrive crisp and dry. Ask about recyclable kraft boxes sized for your bestsellers.',
    city: 'Lahore',
    schedule_date: '2026-11-10',
    schedule_time: '10:30',
    post_type: 'update',
    cta_type: 'learn_more',
    cta_url: 'https://example.com/custom-boxes',
  },
  {
    business_name: 'Austin Roof Pros',
    gmail: 'yourteam@gmail.com',
    post_content:
      'Winter storms are on the way. Book a free roof inspection and our crew will check flashing, gutters and shingles before the first freeze.',
    city: 'Austin',
    post_type: 'offer',
    cta_type: 'book',
    event_title: 'Free winter roof inspection',
    start_datetime: '2026-11-15',
    end_datetime: '2026-12-15',
    offer_terms: 'Residential roofs within our service area. One inspection per household.',
  },
  {
    business_name: 'Smile Dental Care',
    gmail: 'clients.gbp2@gmail.com',
    post_content:
      'Join us for our family open house: meet the team, tour the new clinic and get kids’ hygiene kits while supplies last.',
    post_type: 'event',
    cta_type: 'sign_up',
    image: 'open-house.jpg',
    event_title: 'Family open house',
    start_datetime: '2026-11-22 10:00',
    end_datetime: '2026-11-22 14:00',
  },
];
