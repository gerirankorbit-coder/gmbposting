import type { NotificationType } from '../../shared/types.js';
import { dbError, isUniqueViolation } from '../db/helpers.js';
import { db } from '../db/supabase.js';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  clientId?: string | null;
  /** At most one unread notification exists per key; duplicates are silently skipped. */
  dedupeKey?: string | null;
}

/** Creates an in-app notification. Returns false when deduplicated or on failure. */
export async function notify(input: NotificationInput): Promise<boolean> {
  const { error } = await db()
    .from('notifications')
    .insert({
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      client_id: input.clientId ?? null,
      dedupe_key: input.dedupeKey ?? null,
    });
  if (!error) return true;
  if (isUniqueViolation(error)) return false;
  console.error('[notify] failed to create notification', dbError(error).message);
  return false;
}
