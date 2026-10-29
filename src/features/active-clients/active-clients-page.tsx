import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { startOfDay, startOfMonth, subDays } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  FileEdit,
  Hourglass,
  PenSquare,
  Search,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { PostingState, PostingStatusClient, PostingStatusLocation } from '../../../shared/types';
import { api } from '@/lib/api';
import { formatLocal, timeAgo } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { useDebounce } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/app/error-state';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Period = 'today' | '7d' | 'month' | '30d';
type Filter = 'all' | 'posted' | 'not_posted' | 'failed' | 'cant_post';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
];

function sinceFor(period: Period): string {
  const now = new Date();
  if (period === 'today') return startOfDay(now).toISOString();
  if (period === 'month') return startOfMonth(now).toISOString();
  return startOfDay(subDays(now, period === '7d' ? 6 : 29)).toISOString();
}

const STATE_META: Record<PostingState, { label: string; icon: LucideIcon; badge: 'emerald' | 'violet' | 'amber' | 'gray' | 'rose' }> = {
  posted: { label: 'Posted', icon: CheckCircle2, badge: 'emerald' },
  scheduled: { label: 'Scheduled', icon: Clock3, badge: 'violet' },
  pending_approval: { label: 'Awaiting approval', icon: Hourglass, badge: 'amber' },
  draft: { label: 'Draft', icon: FileEdit, badge: 'gray' },
  failed: { label: 'Failed', icon: XCircle, badge: 'rose' },
  not_posted: { label: 'Not posted', icon: CircleDashed, badge: 'amber' },
  cant_post: { label: "Can't post", icon: Ban, badge: 'rose' },
};

const FILTERS: { value: Filter; label: string; match: (s: PostingState) => boolean }[] = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'posted', label: 'Posted', match: (s) => s === 'posted' },
  { value: 'not_posted', label: 'Not posted yet', match: (s) => s !== 'posted' },
  { value: 'failed', label: 'Failed', match: (s) => s === 'failed' },
  { value: 'cant_post', label: "Can't post", match: (s) => s === 'cant_post' },
];

export function ActiveClientsPage() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebounce(searchInput.trim(), 300);
  const period = (PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : 'today') as Period;
  const filter = (FILTERS.some((f) => f.value === params.get('filter')) ? params.get('filter') : 'all') as Filter;
  const since = useMemo(() => sinceFor(period), [period]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: qk.postingStatus(since, search),
    queryFn: () => api.get<PostingStatusClient[]>('/posting-status', { since, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const all = data ?? [];
  const locations = all.flatMap((c) => c.locations);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, locations.filter((l) => f.match(l.state)).length])) as Record<Filter, number>;
  const match = FILTERS.find((f) => f.value === filter)!.match;
  const visible = all
    .map((c) => ({ ...c, locations: c.locations.filter((l) => match(l.state)) }))
    .filter((c) => c.locations.length > 0 || (filter === 'all' && c.locations.length === 0));

  return (
    <>
      <PageHeader
        eyebrow="Posting"
        title="Active Clients"
        highlight="Clients"
        description="Only active clients are posted to. See at a glance which of their locations got a post in the period, and why the others did not."
      />

      <Card className="p-3 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setParam('search', e.target.value.trim() || null);
              }}
              placeholder="Search active clients by name…"
              className="pl-9"
              aria-label="Search active clients"
            />
          </div>
          <Select value={period} onValueChange={(v) => setParam('period', v === 'today' ? null : v)}>
            <SelectTrigger aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Show locations">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setParam('filter', f.value === 'all' ? null : f.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
                filter === f.value
                  ? 'border-transparent bg-orbit-gradient text-white shadow-glow'
                  : 'border-orbit-line bg-white text-orbit-body hover:border-orbit-primary/40',
              )}
            >
              {f.label}
              <span className={cn('rounded-full px-1.5 text-xs', filter === f.value ? 'bg-white/25' : 'bg-orbit-primary/10 text-orbit-primary')}>
                {data ? counts[f.value] : '…'}
              </span>
            </button>
          ))}
        </div>

        {data && locations.length > 0 && (
          <p className="mt-3 text-sm text-orbit-muted">
            <span className="font-bold text-orbit-heading">
              {counts.posted} of {locations.length}
            </span>{' '}
            locations of {all.length} active client{all.length === 1 ? '' : 's'} posted{' '}
            {period === 'today' ? 'today' : `in the ${PERIODS.find((p) => p.value === period)!.label.toLowerCase()}`}.
          </p>
        )}
      </Card>

      <div className={cn('mt-6 grid gap-4 transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : error ? (
          <Card>
            <ErrorState error={error} onRetry={() => void refetch()} />
          </Card>
        ) : all.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title={search ? 'No active client matches' : 'No active clients yet'}
              description={
                search
                  ? 'Inactive clients are not listed here. Find them on the Locations page and activate them.'
                  : 'Clients found through Google start inactive. Search for a client on the Locations page and activate it.'
              }
              action={
                <Button asChild>
                  <Link to={search ? `/locations?search=${encodeURIComponent(search)}` : '/locations?posting=inactive_clients'}>Go to Locations</Link>
                </Button>
              }
            />
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState icon={CheckCircle2} title="Nothing in this filter" description="Every location of these clients is in another group." />
          </Card>
        ) : (
          visible.map((c) => <ClientCard key={c.id} client={c} total={all.find((x) => x.id === c.id)!.locations} />)
        )}
      </div>
    </>
  );
}

function ClientCard({
  client,
  total,
}: {
  client: PostingStatusClient;
  total: PostingStatusLocation[];
}) {
  const posted = total.filter((l) => l.state === 'posted').length;
  const pct = total.length ? Math.round((posted / total.length) * 100) : 0;
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
        <div className="min-w-[12rem] flex-1">
          <h2 className="wrap-anywhere text-lg">{client.name}</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-40 max-w-full overflow-hidden rounded-full bg-orbit-primary/10" aria-hidden>
              <div className="h-full rounded-full bg-orbit-gradient" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-orbit-heading">
              {posted}/{total.length} posted
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to={`/compose?locations=${total.filter((l) => l.state !== 'cant_post').map((l) => l.id).join(',')}`}>
              <PenSquare /> Compose
            </Link>
          </Button>
        </div>
      </div>

      {client.locations.length === 0 ? (
        <p className="mt-4 text-sm text-orbit-muted">This client has no locations yet. Assign locations to it on the Locations page.</p>
      ) : (
        <ul className="mt-4 divide-y divide-orbit-line rounded-2xl border border-orbit-line bg-white/60">
          {client.locations.map((l) => (
            <LocationRow key={l.id} location={l} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LocationRow({ location: l }: { location: PostingStatusLocation }) {
  const meta = STATE_META[l.state];
  const Icon = meta.icon;
  return (
    <li className="flex flex-wrap items-start gap-3 p-3 sm:p-4">
      <div className="min-w-[12rem] flex-1">
        <Link to={`/locations/${l.id}`} className="wrap-anywhere text-sm font-bold text-orbit-heading hover:text-orbit-primary">
          {l.title}
        </Link>
        {l.city && <p className="wrap-anywhere text-xs text-orbit-muted">{l.city}</p>}
        {l.state === 'posted' && l.last_published_at && (
          <p className="mt-1 text-xs text-emerald-700" title={formatLocal(l.last_published_at)}>
            Last post {timeAgo(l.last_published_at)}
          </p>
        )}
        {l.reason && (
          <p className={cn('mt-1 flex items-start gap-1.5 text-xs', l.state === 'failed' || l.state === 'cant_post' ? 'text-rose-700' : 'text-orbit-body')}>
            {(l.state === 'failed' || l.state === 'cant_post') && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
            <span className="wrap-anywhere">
              {l.reason}
              {l.state === 'scheduled' && l.next_scheduled_at && ` Next: ${formatLocal(l.next_scheduled_at)}.`}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={meta.badge}>
          <Icon className="h-3 w-3" aria-hidden /> {meta.label}
        </Badge>
        <RowAction location={l} />
      </div>
    </li>
  );
}

function RowAction({ location: l }: { location: PostingStatusLocation }) {
  if (l.state === 'posted' && l.google_url) {
    return (
      <Button asChild size="sm" variant="ghost">
        <a href={l.google_url} target="_blank" rel="noreferrer">
          <ExternalLink /> View
        </a>
      </Button>
    );
  }
  if (l.block === 'reconnect') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/connections">Reconnect</Link>
      </Button>
    );
  }
  if (l.block === 'unverified') {
    return (
      <Button asChild size="sm" variant="outline">
        <a href="https://business.google.com/locations" target="_blank" rel="noreferrer">
          <ExternalLink /> Verify on Google
        </a>
      </Button>
    );
  }
  if (l.state === 'failed') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={`/locations/${l.id}`}>See post</Link>
      </Button>
    );
  }
  if (l.state === 'pending_approval') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/approvals">Approvals</Link>
      </Button>
    );
  }
  if (l.state === 'not_posted' || l.state === 'draft') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={`/compose?locations=${l.id}`}>
          <PenSquare /> Post
        </Link>
      </Button>
    );
  }
  return null;
}
