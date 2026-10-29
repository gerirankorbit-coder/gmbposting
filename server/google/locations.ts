import type { GoogleClient } from './client.js';
import { guessTimeZone } from './timezone.js';

const BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const READ_MASK = 'name,title,storefrontAddress,serviceArea,websiteUri,categories,metadata';

interface PostalAddress {
  regionCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  sublocality?: string;
  addressLines?: string[];
}

export interface GbpLocation {
  name: string; // locations/456
  title?: string;
  storefrontAddress?: PostalAddress;
  serviceArea?: {
    businessType?: string;
    places?: { placeInfos?: Array<{ placeName?: string; placeId?: string }> };
    regionCode?: string;
  };
  websiteUri?: string;
  categories?: { primaryCategory?: { name?: string; displayName?: string } };
  metadata?: {
    mapsUri?: string;
    placeId?: string;
    newReviewUri?: string;
    /** Verified and in good standing. Proto3 JSON omits false values. */
    hasVoiceOfMerchant?: boolean;
    canOperateLocalPost?: boolean;
  };
}

/** Lists every location of an account. An empty `{}` response means zero locations. */
export function listLocations(client: GoogleClient, accountName: string): Promise<GbpLocation[]> {
  return client.paginate<GbpLocation>(`${BASE}/${accountName}/locations`, 'locations', {
    readMask: READ_MASK,
    pageSize: 100,
  });
}

export interface NormalizedLocation {
  location_name: string;
  title: string;
  address_text: string | null;
  city: string | null;
  service_area_text: string | null;
  primary_category: string | null;
  website_uri: string | null;
  maps_uri: string | null;
  place_id: string | null;
  google_verified: boolean | null;
}

/**
 * Unverified, pending-verification and suspended profiles cannot take posts. Google omits false
 * flags from JSON, so a missing flag means false, but no metadata at all means "unknown".
 */
export function googleVerified(loc: GbpLocation): boolean | null {
  if (!loc.metadata) return null;
  return loc.metadata.hasVoiceOfMerchant === true || loc.metadata.canOperateLocalPost === true;
}

/** Maps a Business Information location to our `locations` columns. */
export function normalizeLocation(loc: GbpLocation): NormalizedLocation {
  const addr = loc.storefrontAddress;
  const addressParts = [
    ...(addr?.addressLines ?? []),
    addr?.sublocality,
    addr?.locality,
    addr?.administrativeArea,
    addr?.postalCode,
  ].filter((p): p is string => !!p && p.trim() !== '');
  const places = loc.serviceArea?.places?.placeInfos
    ?.map((p) => p.placeName)
    .filter((p): p is string => !!p);
  const firstPlaceCity = places?.[0]?.split(',')[0]?.trim() || null;
  return {
    location_name: loc.name,
    title: loc.title?.trim() || loc.name,
    address_text: addressParts.length ? addressParts.join(', ') : null,
    city: addr?.locality?.trim() || firstPlaceCity,
    service_area_text: places?.length ? places.join('; ') : null,
    primary_category: loc.categories?.primaryCategory?.displayName ?? null,
    website_uri: loc.websiteUri ?? null,
    maps_uri: loc.metadata?.mapsUri ?? null,
    place_id: loc.metadata?.placeId ?? null,
    google_verified: googleVerified(loc),
  };
}

/** Best guess of a location's IANA time zone from its address or service area (null if unknown). */
export function guessLocationTimeZone(loc: GbpLocation, addressText: string | null): string | null {
  return guessTimeZone({
    regionCode: loc.storefrontAddress?.regionCode,
    administrativeArea: loc.storefrontAddress?.administrativeArea,
    serviceAreaRegionCode: loc.serviceArea?.regionCode,
    servicePlaces: loc.serviceArea?.places?.placeInfos?.map((p) => p.placeName),
    addressText,
  });
}
