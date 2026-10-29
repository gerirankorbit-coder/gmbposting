import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Clock3,
  Eye,
  Globe2,
  MapPin,
  MoreHorizontal,
  Pencil,
  PenSquare,
  Power,
  PowerOff,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { LocationDTO, Paginated } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { api } from '@/lib/api';
import { useClients, useConnections } from '@/lib/queries';
import { qk } from '@/lib/query-keys';
import { useDebounce } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/app/error-state';
import { Pagination } from '@/components/app/pagination';
import { TimezoneSelect } from '@/components/app/timezone-select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LastPostCell } from './last-post-cell';
import { LocationEditDialog } from './location-edit-dialog';
import { ClientStatusCell, UnverifiedBadge, useSetClientsActive } from './client-status';
import { useBulkUpdateLocations, useUpdateLocation } from './use-location-actions';

const ALL = 'all';
const PAGE_SIZE = 25;
export function LocationsPage() {
  const canManage = useHasRole('manager');
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebounce(searchInput.trim(), 300);
  const clientId = params.get('clientId') ?? ALL;
  const connectionId = params.get('connectionId') ?? ALL;
  const status = params.get('status') ?? 'active';
  // One "Posting" filter covers client activation and Google verification.
  const posting = params.get('posting') ?? ALL;
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (value === null || value === ALL || value === '') next.delete(key);
    else next.set(key, value);
    if (resetPage && key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('search') ?? '') !== search) setParam('search', search || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = {
    search: search || undefined,
    clientId: clientId === ALL ? undefined : clientId,
    connectionId: connectionId === ALL ? undefined : connectionId,
    status,
    clientStatus: posting === 'active_clients' ? 'active' : posting === 'inactive_clients' ? 'inactive' : undefined,
    verification: posting === 'unverified' ? 'unverified' : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: qk.locations(query),
    queryFn: () => api.get<Paginated<LocationDTO>>('/locations', query),
    placeholderData: keepPreviousData,
  });
  const { data: clients } = useClients();
  const { data: connections } = useConnections();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LocationDTO | null>(null);
  const update = useUpdateLocation();
  const bulk = useBulkUpdateLocations();

  const setClientsActive = useSetClientsActive();

  useEffect(() => setSelected(new Set()), [search, clientId, connectionId, status, posting, page]);

  const items = data?.items ?? [];
  const allOnPage = items.length > 0 && items.every((l) => selected.has(l.id));
  const someOnPage = items.some((l) => selected.has(l.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPage) items.forEach((l) => next.delete(l.id));
    else items.forEach((l) => next.add(l.id));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const runBulk = (patch: { client_id?: string | null; is_active?: boolean; timezone?: string }) =>
    bulk.mutate({ ids: [...selected], ...patch }, { onSuccess: () => setSelected(new Set()) });

  const hasFilters =
    !!search || clientId !== ALL || connectionId !== ALL || status !== 'active' || posting !== ALL;
  const selectedInactiveClients = [
    ...new Set(items.filter((l) => selected.has(l.id) && l.client && !l.client.is_active).map((l) => l.client!.id)),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Profiles"
        title="Locations"
        highlight="Locations"
        description="Every Business Profile your connected Gmails can manage. Only locations of active clients are posted to: search a client's name and activate it here."
      />

      <Card className="p-3 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search business, client, city, address…"
              className="pl-9"
              aria-label="Search locations"
            />
          </div>
          <Select value={clientId} onValueChange={(v) => setParam('clientId', v)}>
            <SelectTrigger aria-label="Filter by client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={connectionId} onValueChange={(v) => setParam('connectionId', v)}>
            <SelectTrigger aria-label="Filter by Gmail">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Gmails</SelectItem>
              {connections?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setParam('status', v === 'active' ? null : v)}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={posting} onValueChange={(v) => setParam('posting', v)}>
            <SelectTrigger aria-label="Filter by client status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any client status</SelectItem>
              <SelectItem value="active_clients">Active clients</SelectItem>
              <SelectItem value="inactive_clients">Inactive clients</SelectItem>
              <SelectItem value="unverified">Not verified on Google</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setParams({}, { replace: true });
              }}
            >
              <X /> Clear filters
            </Button>
          </div>
        )}

        {canManage && selected.size > 0 && (
          <BulkBar
            count={selected.size}
            busy={bulk.isPending}
            onAssign={(id) => runBulk({ client_id: id })}
            onActive={(v) => runBulk({ is_active: v })}
            onTimezone={(tz) => runBulk({ timezone: tz })}
            inactiveClients={selectedInactiveClients.length}
            onActivateClients={() => setClientsActive.mutate({ ids: selectedInactiveClients, active: true })}
            onClear={() => setSelected(new Set())}
          />
        )}

        <div className={cn('mt-4 transition-opacity', isFetching && !isLoading && 'opacity-70')}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title={hasFilters ? 'No locations match these filters' : 'No locations synced yet'}
              description={
                hasFilters
                  ? 'Try a different search or clear the filters.'
                  : 'Connect a Google account and run a sync to import its Business Profiles.'
              }
              action={
                !hasFilters && (
                  <Button asChild>
                    <Link to="/connections">Go to Connections</Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {canManage && (
                        <TableHead>
                          <Checkbox
                            checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
                            onCheckedChange={toggleAll}
                            aria-label="Select all on this page"
                          />
                        </TableHead>
                      )}
                      <TableHead>Business</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Gmail access</TableHead>
                      <TableHead>Time zone</TableHead>
                      <TableHead>Last post</TableHead>
                      <TableHead>Location on</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((l) => (
                      <TableRow key={l.id} data-state={selected.has(l.id) ? 'selected' : undefined}>
                        {canManage && (
                          <TableCell>
                            <Checkbox
                              checked={selected.has(l.id)}
                              onCheckedChange={() => toggle(l.id)}
                              aria-label={`Select ${l.title}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="w-[300px] max-w-[300px]">
                          <Link to={`/locations/${l.id}`} className="wrap-anywhere font-bold text-orbit-heading hover:text-orbit-primary" title={l.title}>
                            {l.title}
                          </Link>
                          <p className="wrap-anywhere text-xs text-orbit-muted">
                            {[l.primary_category, l.address_text ?? l.service_area_text].filter(Boolean).join(' · ') || '—'}
                          </p>
                          <UnverifiedBadge location={l} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* max-width on a table cell is ignored, so constrain an inner block instead. */}
                          <div className="w-[180px] max-w-[180px]">
                            <ClientStatusCell location={l} canManage={canManage} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <AccessChips location={l} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{l.timezone}</TableCell>
                        <TableCell>
                          <LastPostCell iso={l.last_post_at} />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={l.is_active}
                            disabled={!canManage || update.isPending}
                            onCheckedChange={(v) => update.mutate({ id: l.id, patch: { is_active: v } })}
                            aria-label={`${l.title} active`}
                          />
                        </TableCell>
                        <TableCell>
                          <RowMenu location={l} canManage={canManage} onEdit={() => setEditing(l)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="flex flex-col gap-3 lg:hidden">
                {items.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      'rounded-2xl border border-orbit-line bg-white/70 p-4',
                      selected.has(l.id) && 'border-orbit-primary/40 bg-orbit-primary/[0.04]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {canManage && (
                        <Checkbox
                          className="mt-1"
                          checked={selected.has(l.id)}
                          onCheckedChange={() => toggle(l.id)}
                          aria-label={`Select ${l.title}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/locations/${l.id}`} className="font-bold text-orbit-heading">
                          {l.title}
                        </Link>
                        <p className="wrap-anywhere text-xs text-orbit-muted">{l.address_text ?? l.service_area_text ?? '—'}</p>
                        <UnverifiedBadge location={l} />
                      </div>
                      <RowMenu location={l} canManage={canManage} onEdit={() => setEditing(l)} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <ClientStatusCell location={l} canManage={canManage} />
                      <AccessChips location={l} />
                      <span className="text-orbit-muted">{l.timezone}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <LastPostCell iso={l.last_post_at} />
                      <Switch
                        checked={l.is_active}
                        disabled={!canManage || update.isPending}
                        onCheckedChange={(v) => update.mutate({ id: l.id, patch: { is_active: v } })}
                        aria-label={`${l.title} active`}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.total ?? 0}
                onPageChange={(p) => setParam('page', p === 1 ? null : String(p), false)}
              />
            </>
          )}
        </div>
      </Card>

      <LocationEditDialog location={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

function AccessChips({ location }: { location: LocationDTO }) {
  const access = location.access;
  if (!access.length) return <span className="text-sm text-rose-600">No access</span>;
  const label = access.length === 1 ? access[0]!.email : `${access[0]!.email} +${access.length - 1}`;
  const anyIssue = access.some((a) => a.status !== 'active');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold',
            anyIssue ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-orbit-line bg-white text-orbit-body',
          )}
          tabIndex={0}
        >
          <span className="truncate">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="space-y-0.5">
          {access.map((a) => (
            <li key={a.connection_id}>
              {a.email}
              {a.connection_id === location.default_connection_id ? ' (default)' : ''}
              {a.status !== 'active' ? ' (needs reconnect)' : ''}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function RowMenu({ location, canManage, onEdit }: { location: LocationDTO; canManage: boolean; onEdit: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${location.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to={`/locations/${location.id}`}>
            <Eye /> View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/compose?locations=${location.id}`}>
            <PenSquare /> Compose post
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkBar({
  count,
  busy,
  onAssign,
  onActive,
  onTimezone,
  inactiveClients,
  onActivateClients,
  onClear,
}: {
  count: number;
  busy: boolean;
  onAssign: (clientId: string | null) => void;
  onActive: (active: boolean) => void;
  onTimezone: (tz: string) => void;
  inactiveClients: number;
  onActivateClients: () => void;
  onClear: () => void;
}) {
  const { data: clients } = useClients();
  const [tz, setTz] = useState('');
  const [tzOpen, setTzOpen] = useState(false);
  const sortedClients = useMemo(() => clients ?? [], [clients]);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-orbit-gradient-soft p-3" role="region" aria-label="Bulk actions">
      <span className="mr-1 text-sm font-bold text-orbit-heading">{count} selected</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy}>
            <Users /> Assign to client
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto">
          <DropdownMenuItem onSelect={() => onAssign(null)}>Unassigned</DropdownMenuItem>
          {sortedClients.map((c) => (
            <DropdownMenuItem key={c.id} onSelect={() => onAssign(c.id)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {inactiveClients > 0 && (
        <Button size="sm" disabled={busy} onClick={onActivateClients}>
          <Power /> Activate {inactiveClients === 1 ? 'client' : `${inactiveClients} clients`}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onActive(true)}>
        <Power /> Turn locations on
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onActive(false)}>
        <PowerOff /> Turn locations off
      </Button>
      <Popover open={tzOpen} onOpenChange={setTzOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy}>
            <Globe2 /> Set time zone
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3">
          <TimezoneSelect value={tz} onChange={setTz} />
          <Button
            size="sm"
            className="w-full"
            disabled={!tz}
            onClick={() => {
              onTimezone(tz);
              setTzOpen(false);
            }}
          >
            <Clock3 /> Apply to {count}
          </Button>
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
        <X /> Clear
      </Button>
    </div>
  );
}
