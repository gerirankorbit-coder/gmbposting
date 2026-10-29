import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ListChecks, PenSquare, Search, X } from 'lucide-react';
import { zonedWallToUtc } from '../../../shared/schedule';
import { POST_STATUSES, type Paginated, type PostListItemDTO, type PostStatus } from '../../../shared/types';
import { api } from '@/lib/api';
import { browserTimeZone } from '@/lib/format';
import { useClients } from '@/lib/queries';
import { qk } from '@/lib/query-keys';
import { useDebounce } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { ClientDot } from '@/components/app/client-dot';
import { ErrorState } from '@/components/app/error-state';
import { LocationCombobox } from '@/components/app/location-combobox';
import { Pagination } from '@/components/app/pagination';
import { POST_STATUS_META, PostStatusBadge } from '@/components/app/status-badge';
import { ZonedTime } from '@/components/app/zoned-time';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePostUi } from '@/features/posts/post-actions';
import { PostRowMenu } from '@/features/posts/post-row-menu';
import { PostThumb } from '@/features/posts/post-thumb';

const ALL = 'all';
const PAGE_SIZE = 25;

export function QueuePage() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebounce(searchInput.trim(), 300);
  const status = params.get('status') ?? ALL;
  const clientId = params.get('clientId') ?? ALL;
  const locationId = params.get('locationId') ?? '';
  const importId = params.get('importId') ?? '';
  const fromDate = params.get('from') ?? '';
  const toDate = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const { data: clients } = useClients();
  const ui = usePostUi();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get('search') ?? '') !== search) setParam('search', search || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const tz = browserTimeZone();
  const query = {
    status: status === ALL ? undefined : status,
    clientId: clientId === ALL ? undefined : clientId,
    locationId: locationId || undefined,
    importId: importId || undefined,
    from: fromDate ? zonedWallToUtc(fromDate, '00:00', tz) : undefined,
    to: toDate ? zonedWallToUtc(toDate, '23:59', tz) : undefined,
    search: search || undefined,
    sort: 'scheduled_at',
    dir: status === 'published' ? 'desc' : status === 'scheduled' || status === 'pending_approval' ? 'asc' : 'desc',
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: qk.posts(query),
    queryFn: () => api.get<Paginated<PostListItemDTO>>('/posts', query),
    placeholderData: keepPreviousData,
  });
  const items = data?.items ?? [];
  const hasFilters = status !== ALL || clientId !== ALL || !!locationId || !!importId || !!fromDate || !!toDate || !!search;

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Post Queue"
        highlight="Queue"
        description="Every post across every client. Filter, edit, reschedule, retry or open it on Google."
        actions={
          <Button asChild>
            <Link to="/compose">
              <PenSquare /> New post
            </Link>
          </Button>
        }
      />
      <Card className="p-3 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_minmax(0,1.5fr)]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search post text…" className="pl-9" aria-label="Search posts" />
          </div>
          <Select value={status} onValueChange={(v) => setParam('status', v)}>
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {POST_STATUSES.map((s: PostStatus) => (
                <SelectItem key={s} value={s}>
                  {POST_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={(v) => setParam('clientId', v)}>
            <SelectTrigger aria-label="Client">
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
          <LocationCombobox value={locationId} onChange={(v) => setParam('locationId', v || null)} />
          <div className="flex min-w-0 items-center gap-2">
            <Input type="date" className="min-w-0 px-2.5" aria-label="From date" value={fromDate} onChange={(e) => setParam('from', e.target.value || null)} />
            <span className="text-orbit-muted">–</span>
            <Input type="date" className="min-w-0 px-2.5" aria-label="To date" value={toDate} onChange={(e) => setParam('to', e.target.value || null)} />
          </div>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setSearchInput(''); setParams({}, { replace: true }); }}>
            <X /> Clear filters
          </Button>
        )}

        <div className={cn('mt-4 transition-opacity', isFetching && !isLoading && 'opacity-70')}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={hasFilters ? 'No posts match these filters' : 'The queue is empty'}
              description={hasFilters ? 'Try different filters.' : 'Posts you compose or import show up here.'}
              action={!hasFilters && <Button asChild><Link to="/compose">Compose a post</Link></Button>}
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Post</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Gmail</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => ui.openDrawer(p)}>
                        <TableCell className="max-w-md">
                          <div className="flex items-start gap-3">
                            <PostThumb post={p} />
                            <div className="min-w-0">
                              <button type="button" className="line-clamp-2 text-left text-sm text-orbit-body hover:text-orbit-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60" onClick={(e) => { e.stopPropagation(); ui.openDrawer(p); }}>
                                {p.event_title ? <strong className="text-orbit-heading">{p.event_title} · </strong> : null}
                                {p.summary || '—'}
                              </button>
                              {p.last_error && <p className="mt-0.5 wrap-anywhere text-xs text-rose-600">{p.last_error}</p>}
                              {p.review_note && p.status === 'draft' && <p className="mt-0.5 wrap-anywhere text-xs text-amber-700">Note: {p.review_note}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-[200px] max-w-[200px]">
                            <p className="wrap-anywhere text-sm font-semibold text-orbit-heading" title={p.location?.title}>{p.location?.title}</p>
                            <ClientDot client={p.location?.client ?? null} className="text-xs" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <PostStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ZonedTime iso={p.published_at ?? p.scheduled_at} timeZone={p.location?.timezone ?? tz} />
                        </TableCell>
                        <TableCell>
                          <div className="w-[180px] max-w-[180px] wrap-anywhere text-sm" title={p.connection_email ?? undefined}>{p.connection_email ?? '—'}</div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <PostRowMenu actions={ui.actionsFor(p)} label={p.location?.title ?? 'post'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-3 lg:hidden">
                {items.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-orbit-line bg-white/70 p-4">
                    <div className="flex items-start gap-3">
                      <PostThumb post={p} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ui.openDrawer(p)}>
                        <p className="wrap-anywhere text-sm font-bold text-orbit-heading">{p.location?.title}</p>
                        <p className="line-clamp-2 text-sm text-orbit-body">{p.summary || p.event_title || '—'}</p>
                      </button>
                      <PostRowMenu actions={ui.actionsFor(p)} label={p.location?.title ?? 'post'} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <PostStatusBadge status={p.status} />
                      <ZonedTime iso={p.published_at ?? p.scheduled_at} timeZone={p.location?.timezone ?? tz} />
                    </div>
                    {p.last_error && <p className="mt-2 text-xs text-rose-600">{p.last_error}</p>}
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={(p) => setParam('page', p === 1 ? null : String(p))} />
            </>
          )}
        </div>
      </Card>
      {ui.elements}
    </>
  );
}
