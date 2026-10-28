import { unwrap } from './helpers.js';
import { db } from './supabase.js';
import type { Json } from './types.js';

export interface ActivityInput {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, Json | undefined>;
}

/**
 * Writes an activity log entry. Failures are logged but never thrown: auditing must not
 * break the action being audited.
 */
export async function logActivity(input: ActivityInput | ActivityInput[]): Promise<void> {
  const entries = (Array.isArray(input) ? input : [input]).map((e) => ({
    actor: e.actor,
    action: e.action,
    entity_type: e.entityType ?? null,
    entity_id: e.entityId ?? null,
    details: (e.details ?? {}) as Json,
  }));
  if (!entries.length) return;
  try {
    unwrap(await db().from('activity_log').insert(entries), 'Activity log');
  } catch (err) {
    console.error('[activity] failed to write activity log', err);
  }
}

export const SYSTEM_ACTOR = 'system';
