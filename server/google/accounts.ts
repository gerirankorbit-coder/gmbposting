import type { GoogleClient } from './client.js';

const BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';

export interface GbpAccount {
  name: string; // accounts/123
  accountName?: string;
  type?: string; // PERSONAL | LOCATION_GROUP | USER_GROUP | ORGANIZATION
  role?: string; // PRIMARY_OWNER | OWNER | MANAGER | SITE_MANAGER
  verificationState?: string;
  vettedState?: string;
}

export function listAccounts(client: GoogleClient): Promise<GbpAccount[]> {
  return client.paginate<GbpAccount>(`${BASE}/accounts`, 'accounts', { pageSize: 20 });
}
