import type { NotificationType } from '../../shared/types.js';
import { dbError, isUniqueViolation } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { EMAIL_TYPES, sendDigestIfDue } from './email.js';

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
  if (!error) {
    if (EMAIL_TYPES.includes(input.type)) await sendDigestIfDue();
    return true;
  }
  if (isUniqueViolation(error)) return false;
  console.error('[notify] failed to create notification', dbError(error).message);
  return false;
}

/** Marks unread notifications with these dedupe keys as read (e.g. after a refill or reconnect). */
export async function resolveNotifications(dedupeKeys: string[]): Promise<void> {
  if (!dedupeKeys.length) return;
  await db().from('notifications').update({ is_read: true }).in('dedupe_key', dedupeKeys).eq('is_read', false);
}
