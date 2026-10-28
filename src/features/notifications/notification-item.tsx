import type { NotificationDTO } from '../../../shared/types';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NOTIFICATION_META } from './notification-meta';

export function NotificationItem({ n, compact = false }: { n: NotificationDTO; compact?: boolean }) {
  const meta = NOTIFICATION_META[n.type];
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-orbit-heading', n.is_read ? 'font-medium' : 'font-bold')}>{n.title}</p>
        {n.body && <p className={cn('text-xs text-orbit-muted', compact && 'line-clamp-2')}>{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-orbit-muted">
          {meta.label}
          {n.client_name ? ` · ${n.client_name}` : ''} · {timeAgo(n.created_at)}
        </p>
      </div>
      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orbit-primary" aria-label="Unread" />}
    </div>
  );
}
