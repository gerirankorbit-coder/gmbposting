import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { NOTIFICATION_TYPES } from '../../../shared/types';
import { useClients } from '@/lib/queries';
import { ErrorState } from '@/components/app/error-state';
import { Pagination } from '@/components/app/pagination';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { NOTIFICATION_META } from './notification-meta';
import { NotificationItem } from './notification-item';
import { useMarkAllRead, useMarkRead, useNotificationFeed } from './use-notifications';

const ALL = 'all';
const PAGE_SIZE = 20;

export function NotificationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? ALL;
  const clientId = params.get('clientId') ?? ALL;
  const unreadOnly = params.get('unread') === '1';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const { data: clients } = useClients();
  const feed = useNotificationFeed({
    type: type === ALL ? undefined : type,
    clientId: clientId === ALL ? undefined : clientId,
    unread: unreadOnly ? '1' : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        highlight="Notifications"
        description="Library stock, failed posts, imports and Google connection alerts."
        actions={
          <Button variant="secondary" onClick={() => markAll.mutate()} disabled={!feed.data?.unread || markAll.isPending}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <Card className="p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={type} onValueChange={(v) => setParam('type', v)}>
            <SelectTrigger className="sm:w-56" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {NOTIFICATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {NOTIFICATION_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={(v) => setParam('clientId', v)}>
            <SelectTrigger className="sm:w-56" aria-label="Client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Switch id="unread-only" checked={unreadOnly} onCheckedChange={(v) => setParam('unread', v ? '1' : null)} />
            <Label htmlFor="unread-only">Unread only</Label>
          </div>
        </div>
        <div className="mt-4">
          {feed.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : feed.error ? (
            <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
          ) : !feed.data?.items.length ? (
            <EmptyState icon={Bell} title="You're all caught up" description="New alerts will appear here." />
          ) : (
            <>
              <ul className="divide-y divide-orbit-line">
                {feed.data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-2xl px-3 py-3.5 text-left transition hover:bg-orbit-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
                        !n.is_read && 'bg-orbit-primary/[0.03]',
                      )}
                      onClick={() => {
                        if (!n.is_read) markRead.mutate([n.id]);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <NotificationItem n={n} />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={PAGE_SIZE} total={feed.data.total} onPageChange={(p) => setParam('page', p === 1 ? null : String(p))} />
            </>
          )}
        </div>
      </Card>
    </>
  );
}
