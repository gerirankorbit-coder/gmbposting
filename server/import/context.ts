import type { ConnectionStatus } from '../../shared/types.js';
import { unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { normalizeName, type MatchableLocation } from './match.js';

export interface CtxLocation extends MatchableLocation {
  location_name: string;
  timezone: string;
  is_active: boolean;
  website_uri: string | null;
  client_name: string | null;
  default_cta_url: string | null;
}

export interface CtxConnection {
  id: string;
  email: string;
  status: ConnectionStatus;
  /** location id -> account_name */
  access: Map<string, string>;
}

export interface MatchContext {
  connectionsByEmail: Map<string, CtxConnection>;
  connectionsById: Map<string, CtxConnection>;
  locations: Map<string, CtxLocation>;
  byLocationName: Map<string, CtxLocation>;
  /** Locations each connection can manage (for name matching). */
  poolFor(connectionId: string): CtxLocation[];
}

/** Loads every connection, location and access row once per validation pass. */
export async function loadMatchContext(): Promise<MatchContext> {
  const [conns, locs, access] = await Promise.all([
    db().from('google_connections').select('id, email, status'),
    db()
      .from('locations')
      .select('id, location_name, title, city, address_text, service_area_text, timezone, is_active, website_uri, client:clients(name, default_cta_url)')
      .limit(20000),
    db().from('location_access').select('location_id, connection_id, account_name').limit(50000),
  ]);
  const connections = unwrap(conns, 'Load connections');
  const locations = unwrap(locs, 'Load locations');
  const accessRows = unwrap(access, 'Load access');

  const connectionsById = new Map<string, CtxConnection>(
    connections.map((c) => [c.id, { id: c.id, email: c.email.toLowerCase(), status: c.status, access: new Map() }]),
  );
  for (const a of accessRows) connectionsById.get(a.connection_id)?.access.set(a.location_id, a.account_name);
  const connectionsByEmail = new Map([...connectionsById.values()].map((c) => [c.email, c]));

  const locMap = new Map<string, CtxLocation>();
  for (const l of locations) {
    locMap.set(l.id, {
      id: l.id,
      location_name: l.location_name,
      title: l.title,
      city: l.city,
      address_text: l.address_text,
      service_area_text: l.service_area_text,
      timezone: l.timezone,
      is_active: l.is_active,
      website_uri: l.website_uri,
      client_name: l.client?.name ?? null,
      default_cta_url: l.client?.default_cta_url ?? null,
      norm: normalizeName(l.title),
    });
  }
  const byLocationName = new Map([...locMap.values()].map((l) => [l.location_name, l]));
  const pools = new Map<string, CtxLocation[]>();
  return {
    connectionsByEmail,
    connectionsById,
    locations: locMap,
    byLocationName,
    poolFor(connectionId) {
      let pool = pools.get(connectionId);
      if (!pool) {
        const conn = connectionsById.get(connectionId);
        pool = conn ? [...conn.access.keys()].map((id) => locMap.get(id)).filter((l): l is CtxLocation => !!l) : [];
        pools.set(connectionId, pool);
      }
      return pool;
    },
  };
}
