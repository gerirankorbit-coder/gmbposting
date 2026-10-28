import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '../lib/env.js';
import type { Database } from './types.js';

export type Db = SupabaseClient<Database>;

let client: Db | null = null;

/** Service-role Supabase client (server only; bypasses RLS). Reused across warm invocations. */
export function db(): Db {
  client ??= createClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'orbitpost' } },
    },
  );
  return client;
}
