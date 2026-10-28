import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationItem } from './notification-item';
import { useMarkAllRead, useMarkRead, useNotificationFeed } from './use-notifications';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useNotificationFeed({ page: 1, pageSize: 10 }, true);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orbit-gradient px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-orbit-line px-4 py-3">
          <p className="font-bold text-orbit-heading">Notifications</p>
          <Button variant="ghost" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ul className="max-h-[420px] overflow-y-auto p-1.5">
          {!data?.items.length && <li className="px-4 py-10 text-center text-sm text-orbit-muted">You're all caught up.</li>}
          {data?.items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="w-full rounded-xl p-2.5 text-left transition hover:bg-orbit-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60"
                onClick={() => {
                  if (!n.is_read) markRead.mutate([n.id]);
                  setOpen(false);
                  if (n.link) navigate(n.link);
                }}
              >
                <NotificationItem n={n} compact />
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-orbit-line p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
