import type { ActivityDTO } from '../../../shared/types';

const LABELS: Record<string, string> = {
  'connection.connected': 'connected a Google account',
  'connection.reconnected': 'reconnected a Google account',
  'connection.disconnected': 'disconnected a Google account',
  'connection.synced': 'synced a Google account',
  'connection.sync_failed': 'could not sync a Google account',
  'connection.needs_reauth': 'flagged a Google account for reconnecting',
  'location.updated': 'updated a location',
  'location.bulk_updated': 'updated locations in bulk',
  'location.history_imported': 'imported post history from Google',
  'client.created': 'created a client',
  'client.updated': 'updated a client',
  'client.deleted': 'deleted a client',
  'client.merged': 'merged clients',
  'client.brand_kit_updated': 'updated a brand kit',
  'posts.drafted': 'saved draft posts',
  'posts.submitted': 'submitted posts for approval',
  'posts.approved': 'approved posts',
  'posts.approved_and_scheduled': 'created and scheduled posts',
  'posts.rejected': 'sent posts back',
  'posts.cancelled': 'cancelled posts',
  'posts.deleted': 'deleted posts',
  'post.edited': 'edited a post',
  'post.rescheduled': 'rescheduled a post',
  'post.retry_requested': 'retried a failed post',
  'post.deleted_from_google': 'deleted a post from Google',
  'post.published': 'published a post',
  'post.published_recovered': 'recovered an interrupted post',
  'post.failed': 'could not publish a post',
  'post.retry_scheduled': 'scheduled a retry',
  'post.branded_generated': 'generated a branded graphic',
  'post.image_skipped': 'published without an image',
  'library.images_added': 'added library images',
  'library.image_deleted': 'deleted a library image',
  'ai.variations_generated': 'generated AI variations',
  'import.created': 'uploaded a spreadsheet',
  'import.committed': 'committed an import',
  'import.discarded': 'discarded an import',
  'publisher.run': 'ran the publisher',
  'maintenance.daily': 'ran daily maintenance',
  'settings.updated': 'changed settings',
  'team.role_changed': 'changed a team role',
};

export function activityLabel(action: string): string {
  return LABELS[action] ?? action.replace(/[._]/g, ' ');
}

/** One short line from the most useful detail fields. */
export function activityDetail(a: ActivityDTO): string {
  const d = a.details;
  const parts: string[] = [];
  const pick = (k: string) => (typeof d[k] === 'string' || typeof d[k] === 'number' ? String(d[k]) : null);
  for (const k of ['email', 'title', 'location', 'name', 'client', 'filename', 'campaign', 'into']) {
    const v = pick(k);
    if (v) parts.push(v);
  }
  if (typeof d.count === 'number') parts.push(`${d.count} item${d.count === 1 ? '' : 's'}`);
  if (typeof d.created === 'number') parts.push(`${d.created} created`);
  if (typeof d.published === 'number') parts.push(`${d.published} published, ${d.failed ?? 0} failed`);
  if (typeof d.added === 'number') parts.push(`${d.added} added`);
  if (typeof d.locations === 'number' && a.action === 'connection.synced') parts.push(`${d.locations} locations`);
  if (typeof d.from === 'string' && typeof d.to === 'string' && a.action === 'team.role_changed') parts.push(`${d.from} → ${d.to}`);
  const err = pick('error') ?? pick('note');
  if (err) parts.push(err);
  return parts.join(' · ');
}
