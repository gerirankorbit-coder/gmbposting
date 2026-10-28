/**
 * Infers an IANA time zone from a Business Profile address. Google does not return a location's
 * time zone, so we derive it from country + state/province (storefront address, service-area
 * place names, or the formatted address text). Returns null when it cannot tell confidently.
 */

/** US states (multi-zone states use the zone where most of the population lives). */
const US_STATES: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver', PR: 'America/Puerto_Rico',
};

const US_STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'puerto rico': 'PR',
};

const CA_PROVINCES: Record<string, string> = {
  AB: 'America/Edmonton', BC: 'America/Vancouver', MB: 'America/Winnipeg', NB: 'America/Moncton',
  NL: 'America/St_Johns', NS: 'America/Halifax', NT: 'America/Yellowknife', NU: 'America/Iqaluit',
  ON: 'America/Toronto', PE: 'America/Halifax', QC: 'America/Toronto', SK: 'America/Regina',
  YT: 'America/Whitehorse',
};

const AU_STATES: Record<string, string> = {
  NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide', WA: 'Australia/Perth', TAS: 'Australia/Hobart', NT: 'Australia/Darwin',
};

/** Countries with one main time zone (multi-zone countries use their most populous zone). */
const COUNTRIES: Record<string, string> = {
  PK: 'Asia/Karachi', IN: 'Asia/Kolkata', BD: 'Asia/Dhaka', AE: 'Asia/Dubai', SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar', KW: 'Asia/Kuwait', BH: 'Asia/Bahrain', OM: 'Asia/Muscat', GB: 'Europe/London',
  IE: 'Europe/Dublin', DE: 'Europe/Berlin', FR: 'Europe/Paris', ES: 'Europe/Madrid', IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', CH: 'Europe/Zurich', AT: 'Europe/Vienna',
  SE: 'Europe/Stockholm', NO: 'Europe/Oslo', DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', GR: 'Europe/Athens', TR: 'Europe/Istanbul',
  RO: 'Europe/Bucharest', CZ: 'Europe/Prague', HU: 'Europe/Budapest', UA: 'Europe/Kyiv',
  NZ: 'Pacific/Auckland', SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur', PH: 'Asia/Manila',
  TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong', TW: 'Asia/Taipei', LK: 'Asia/Colombo', NP: 'Asia/Kathmandu',
  ZA: 'Africa/Johannesburg', NG: 'Africa/Lagos', KE: 'Africa/Nairobi', EG: 'Africa/Cairo',
  MA: 'Africa/Casablanca', IL: 'Asia/Jerusalem', JO: 'Asia/Amman', LB: 'Asia/Beirut',
  MX: 'America/Mexico_City', BR: 'America/Sao_Paulo', AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago', CO: 'America/Bogota', PE: 'America/Lima', ID: 'Asia/Jakarta',
  RU: 'Europe/Moscow', JM: 'America/Jamaica',
};

const COUNTRY_WORDS: Record<string, string> = {
  usa: 'US', 'united states': 'US', us: 'US', canada: 'CA', australia: 'AU', pakistan: 'PK',
  'united kingdom': 'GB', uk: 'GB', england: 'GB', india: 'IN', uae: 'AE', 'united arab emirates': 'AE',
};

function fromRegion(country: string | null, area: string | null): string | null {
  const c = country?.toUpperCase() ?? null;
  const a = area?.trim() ?? '';
  const code = a.length <= 3 ? a.toUpperCase() : (US_STATE_NAMES[a.toLowerCase()] ?? a.toUpperCase());
  if ((!c || c === 'US') && US_STATES[code]) return US_STATES[code];
  if (c === 'CA' && CA_PROVINCES[code]) return CA_PROVINCES[code];
  if (c === 'AU' && AU_STATES[code]) return AU_STATES[code];
  if (c === 'US') return null; // US without a recognisable state: too ambiguous
  if (c === 'CA') return 'America/Toronto';
  if (c === 'AU') return 'Australia/Sydney';
  return c ? (COUNTRIES[c] ?? null) : null;
}

/** Parses "City, ST, USA" / "Cheyenne, WY 82001" style text into country + state. */
function fromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  let country: string | null = null;
  const last = parts.at(-1)?.toLowerCase() ?? '';
  if (COUNTRY_WORDS[last]) {
    country = COUNTRY_WORDS[last]!;
    parts.pop();
  }
  // Walk from the end: "WY 82001-4406", "WY", "Texas", "ON M5V 2T6"
  for (let i = parts.length - 1; i >= 0; i--) {
    const token = parts[i]!.replace(/\s+[\dA-Z]{3}\s?[\dA-Z]{3}$/i, '').replace(/\s+\d{4,5}(-\d{4})?$/, '').trim();
    const zone = fromRegion(country, token);
    if (zone && (country || US_STATES[token.toUpperCase()] || US_STATE_NAMES[token.toLowerCase()])) return zone;
  }
  return country ? fromRegion(country, null) : null;
}

export interface TimezoneHints {
  regionCode?: string | null;
  administrativeArea?: string | null;
  serviceAreaRegionCode?: string | null;
  servicePlaces?: (string | null | undefined)[];
  addressText?: string | null;
}

export function guessTimeZone(h: TimezoneHints): string | null {
  if (h.regionCode || h.administrativeArea) {
    const z = fromRegion(h.regionCode ?? null, h.administrativeArea ?? null);
    if (z) return z;
  }
  for (const place of h.servicePlaces ?? []) {
    const z = fromText(place);
    if (z) return z;
  }
  if (h.serviceAreaRegionCode) {
    const z = fromRegion(h.serviceAreaRegionCode, null);
    if (z) return z;
  }
  return fromText(h.addressText);
}
