import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../shared/types.js';
import { env } from '../lib/env.js';
import { dbError, unwrap } from './helpers.js';
import { db } from './supabase.js';
import type { Json } from './types.js';

const KEYS = Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[];

function coerce<K extends keyof AppSettings>(key: K, value: unknown): AppSettings[K] {
  const fallback =
    key === 'default_timezone' ? env.defaultTimezone : DEFAULT_APP_SETTINGS[key];
  if (typeof fallback === 'boolean') {
    return (typeof value === 'boolean' ? value : fallback) as AppSettings[K];
  }
  if (typeof fallback === 'number') {
    return (typeof value === 'number' && Number.isFinite(value) ? value : fallback) as AppSettings[K];
  }
  return (typeof value === 'string' && value ? value : fallback) as AppSettings[K];
}

export async function getSettings(): Promise<AppSettings> {
  const rows = unwrap(
    await db().from('app_settings').select('key, value').in('key', KEYS),
    'Load settings',
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const settings = {} as Record<keyof AppSettings, unknown>;
  for (const key of KEYS) settings[key] = coerce(key, map.get(key));
  return settings as AppSettings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const rows = Object.entries(patch)
    .filter(([key, value]) => KEYS.includes(key as keyof AppSettings) && value !== undefined)
    .map(([key, value]) => ({ key, value: value as Json }));
  if (rows.length) {
    unwrap(await db().from('app_settings').upsert(rows, { onConflict: 'key' }), 'Save settings');
  }
  return getSettings();
}

/** Raw key/value access for internal bookkeeping (e.g. last digest email time). */
export async function getSettingValue(key: string): Promise<Json | null> {
  const { data, error } = await db().from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw dbError(error, 'Load setting');
  return data?.value ?? null;
}

export async function setSettingValue(key: string, value: Json): Promise<void> {
  unwrap(await db().from('app_settings').upsert({ key, value }, { onConflict: 'key' }), 'Save setting');
}
