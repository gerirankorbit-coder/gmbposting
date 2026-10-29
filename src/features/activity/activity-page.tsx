import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Activity, Search } from 'lucide-react';
import type { ActivityDTO, Paginated } from '../../../shared/types';
import { api } from '@/lib/api';
import { formatLocal, timeAgo } from '@/lib/format';
import { useDebounce } from '@/lib/use-debounce';
import { ErrorState } from '@/components/app/error-state';
import { Pagination } from '@/components/app/pagination';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { activityDetail, activityLabel } from './activity-format';

const ALL = 'all';
const ENTITY_TYPES: [string, string][] = [
  ['post', 'Posts'],
  ['campaign', 'Campaigns'],
  ['connection', 'Connections'],
  ['location', 'Locations'],
  ['client', 'Clients'],
  ['import', 'Imports'],
  ['publisher', 'Publisher'],
  ['settings', 'Settings'],
  ['user', 'Team'],
  ['system', 'System'],
];

export function ActivityItem({ a }: { a: ActivityDTO }) {
  const detail = activityDetail(a);
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orbit-gradient text-[11px] font-bold text-white">
        {a.actor_name[0]?.toUpperCase() ?? '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-orbit-body">
          <strong className="text-orbit-heading">{a.actor_name}</strong> {activityLabel(a.action)}
        </p>
        {detail && <p className="wrap-anywhere text-xs text-orbit-muted" title={detail}>{detail}</p>}
      </div>
      <Tooltip>
        <TooltipTrigger className="shrink-0 text-xs text-orbit-muted">{timeAgo(a.created_at)}</TooltipTrigger>
        <TooltipContent>{formatLocal(a.created_at)}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ActivityPage() {
  const [entityType, setEntityType] = useState(ALL);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const query = { entityType: entityType === ALL ? undefined : entityType, search: search || undefined, page, pageSize: 25 };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activity', query],
    queryFn: () => api.get<Paginated<ActivityDTO>>('/activity', query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader eyebrow="Audit" title="Activity Log" highlight="Activity" description="Everything that happened in OrbitPost, by whom and when." />
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
            <SelectTrigger className="sm:w-56" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everything</SelectItem>
              {ENTITY_TYPES.map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(1); }} placeholder="Filter by action, e.g. published" className="pl-9" aria-label="Filter by action" />
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data?.items.length ? (
          <EmptyState icon={Activity} title="No activity yet" description="Actions by your team and the publisher are recorded here." />
        ) : (
          <>
            <ul className="divide-y divide-orbit-line">
              {data.items.map((a) => (
                <li key={a.id} className="py-3">
                  <ActivityItem a={a} />
                  {a.entity_type && (
                    <div className="ml-11 mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{a.entity_type}</Badge>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={25} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
