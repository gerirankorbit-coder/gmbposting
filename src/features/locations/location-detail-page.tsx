import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  DownloadCloud,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MapPin,
  Pencil,
  Tag,
  Clock3,
} from 'lucide-react';
import type { LocationDTO, Paginated, PostDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { ClientDot } from '@/components/app/client-dot';
import { ConnectionStatusBadge, PostStatusBadge } from '@/components/app/status-badge';
import { ErrorState } from '@/components/app/error-state';
import { Pagination } from '@/components/app/pagination';
import { ZonedTime } from '@/components/app/zoned-time';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LastPostCell } from './last-post-cell';
import { LocationEditDialog } from './location-edit-dialog';
import { useImportHistory } from './use-location-actions';

const PAGE_SIZE = 10;
const TOPIC_LABEL = { STANDARD: 'Update', EVENT: 'Event', OFFER: 'Offer' } as const;

export function LocationDetailPage() {
  const { id = '' } = useParams();
  const canManage = useHasRole('manager');
  const [editOpen, setEditOpen] = useState(false);
  const [page, setPage] = useState(1);
  const importHistory = useImportHistory();

  const { data: loc, isLoading, error, refetch } = useQuery({
    queryKey: qk.location(id),
    queryFn: () => api.get<LocationDTO>(`/locations/${id}`),
  });
  const posts = useQuery({
    queryKey: qk.locationPosts(id, page),
    queryFn: () => api.get<Paginated<PostDTO>>(`/locations/${id}/posts`, { page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: !!loc,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !loc) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load this location" />
      </Card>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/locations">
          <ArrowLeft /> All locations
        </Link>
      </Button>
      <PageHeader
        eyebrow={loc.primary_category ?? 'Business Profile'}
        title={loc.title}
        description={loc.address_text ?? loc.service_area_text ?? undefined}
        actions={
          <>
            {canManage && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {canManage && (
              <Button variant="secondary" onClick={() => importHistory.mutate(loc.id)} disabled={importHistory.isPending}>
                {importHistory.isPending ? <Loader2 className="animate-spin" /> : <DownloadCloud />}
                Import post history
              </Button>
            )}
            <Button asChild>
              <Link to={`/compose?locations=${loc.id}`}>
                Compose post
                <ButtonChip>
                  <ArrowRight />
                </ButtonChip>
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <InfoRow icon={Tag} label="Client">
                  <ClientDot client={loc.client} />
                </InfoRow>
                <InfoRow icon={MapPin} label="City">
                  {loc.city ?? '—'}
                </InfoRow>
                <InfoRow icon={Clock3} label="Time zone">
                  {loc.timezone}
                </InfoRow>
                <InfoRow icon={Globe} label="Website">
                  {loc.website_uri ? (
                    <a href={loc.website_uri} target="_blank" rel="noreferrer" className="break-all text-orbit-primary hover:underline">
                      {loc.website_uri.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    '—'
                  )}
                </InfoRow>
                <InfoRow icon={FileText} label="Last post">
                  <LastPostCell iso={loc.last_post_at} />
                </InfoRow>
                <InfoRow icon={Tag} label="Status">
                  <Badge variant={loc.is_active ? 'emerald' : 'gray'}>{loc.is_active ? 'Active' : 'Inactive'}</Badge>
                </InfoRow>
              </dl>
              {loc.maps_uri && (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <a href={loc.maps_uri} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open in Google Maps
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gmail access</CardTitle>
            </CardHeader>
            <CardContent>
              {loc.access.length === 0 ? (
                <p className="text-sm text-rose-600">No connected Gmail can manage this location.</p>
              ) : (
                <ul className="space-y-3">
                  {loc.access.map((a) => (
                    <li key={a.connection_id} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-orbit-heading">{a.email}</p>
                        <p className="text-xs text-orbit-muted">
                          {a.role?.replace(/_/g, ' ').toLowerCase() ?? 'access'} · {a.account_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {a.connection_id === loc.default_connection_id && <Badge variant="violet">Default</Badge>}
                        <ConnectionStatusBadge status={a.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {posts.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : posts.error ? (
              <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
            ) : !posts.data?.items.length ? (
              <EmptyState
                icon={FileText}
                title="No posts yet"
                description="Compose a post for this location, or import its existing posts from Google."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Post</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.data.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-md">
                          <div className="flex items-start gap-3">
                            {p.media_url ? (
                              <img src={p.media_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orbit-primary/10 text-[10px] font-bold uppercase text-orbit-primary">
                                {p.image_source === 'auto' ? 'Auto' : 'Text'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wide text-orbit-muted">{TOPIC_LABEL[p.topic_type]}</p>
                              <p className="line-clamp-2 text-sm text-orbit-body">{p.summary || p.event_title || '—'}</p>
                              {p.last_error && <p className="mt-0.5 line-clamp-1 text-xs text-rose-600">{p.last_error}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <PostStatusBadge status={p.status} />
                          {p.google_search_url && (
                            <a
                              href={p.google_search_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 flex items-center gap-1 text-xs font-semibold text-orbit-primary hover:underline"
                            >
                              View on Google <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ZonedTime iso={p.published_at ?? p.scheduled_at} timeZone={loc.timezone} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination page={page} pageSize={PAGE_SIZE} total={posts.data.total} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <LocationEditDialog location={loc} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Tag; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3">
      <dt className="flex items-center gap-1.5 text-orbit-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-orbit-heading">{children}</dd>
    </div>
  );
}
