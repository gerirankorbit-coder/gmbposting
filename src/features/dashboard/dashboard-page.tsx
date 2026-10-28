import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BookImage,
  CalendarClock,
  CheckCircle2,
  CheckCheck,
  FileSpreadsheet,
  Link2,
  MapPin,
  PenSquare,
  Send,
  Upload,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardDTO } from '../../../shared/types';
import { useHasRole, useMe } from '@/app/auth';
import { api } from '@/lib/api';
import { daysSince, formatLocal, pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ClientDot } from '@/components/app/client-dot';
import { ErrorState } from '@/components/app/error-state';
import { PostStatusBadge } from '@/components/app/status-badge';
import { ZonedTime } from '@/components/app/zoned-time';
import { PageHeader } from '@/components/layout/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityItem } from '@/features/activity/activity-page';
import { ClientAvatar } from '@/features/library/library-page';
import { STOCK_BADGE, STOCK_LABEL, StockBar } from '@/features/library/stock-bar';
import { usePostUi } from '@/features/posts/post-actions';
import { PostThumb } from '@/features/posts/post-thumb';
import { Badge } from '@/components/ui/badge';

function StatCard({ label, value, icon: Icon, to, tone, hint }: { label: string; value: number; icon: LucideIcon; to: string; tone: string; hint?: string }) {
  return (
    <Link to={to} className="glass-card group flex items-start gap-3 p-5 transition hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-orbit-muted">{label}</p>
        <p className="text-3xl font-extrabold tracking-tightest text-orbit-heading">{value.toLocaleString()}</p>
        {hint && <p className="truncate text-xs text-orbit-muted">{hint}</p>}
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { data: me } = useMe();
  const isManager = useHasRole('manager');
  const ui = usePostUi();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardDTO>('/dashboard'),
    refetchInterval: 120_000,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Card>
    );
  }
  const s = data.stats;
  const firstName = me?.name?.split(' ')[0];

  return (
    <>
      <PageHeader
        eyebrow="Mission control"
        title={firstName ? `Welcome back, ${firstName}` : 'Mission Control'}
        highlight={firstName ?? 'Control'}
        description="Your agency's posting at a glance."
        bubbles
        actions={
          <Button asChild>
            <Link to="/compose">
              New post
              <ButtonChip>
                <ArrowRight />
              </ButtonChip>
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Connected Gmails" value={s.connections} icon={Link2} to="/connections" tone="bg-violet-50 text-violet-600" hint={s.connections_needing_reauth ? `${s.connections_needing_reauth} need reconnecting` : 'All healthy'} />
        <StatCard label="Locations" value={s.locations} icon={MapPin} to="/locations" tone="bg-fuchsia-50 text-fuchsia-600" hint={`${data.stale_count} need a post`} />
        <StatCard label="Scheduled · 7 days" value={s.scheduled_this_week} icon={CalendarClock} to="/calendar" tone="bg-violet-50 text-violet-600" hint={s.pending_approval ? `${s.pending_approval} awaiting approval` : undefined} />
        <StatCard label="Published · month" value={s.published_this_month} icon={CheckCircle2} to="/queue?status=published" tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Failed" value={s.failed} icon={XCircle} to="/queue?status=failed" tone="bg-rose-50 text-rose-600" hint={s.failed ? 'Needs attention' : 'Nothing failing'} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/import">
            <FileSpreadsheet /> Import spreadsheet
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/compose">
            <PenSquare /> Compose
          </Link>
        </Button>
        {isManager && s.pending_approval > 0 && (
          <Button asChild variant="secondary" size="sm">
            <Link to="/approvals">
              <CheckCheck /> Review {pluralize(s.pending_approval, 'post')}
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary" size="sm">
          <Link to="/library">
            <Upload /> Add images
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming posts</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/queue?status=scheduled">
                Queue <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data.upcoming.length ? (
              <p className="py-8 text-center text-sm text-orbit-muted">Nothing scheduled yet.</p>
            ) : (
              <ul className="divide-y divide-orbit-line">
                {data.upcoming.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => ui.openDrawer(p)} className="flex w-full items-center gap-3 rounded-xl py-3 text-left transition hover:bg-orbit-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60">
                      <PostThumb post={p} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-orbit-heading">{p.location?.title}</p>
                        <p className="truncate text-xs text-orbit-muted">{p.summary || p.event_title}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <PostStatusBadge status={p.status} />
                        <div className="mt-1 text-xs">
                          <ZonedTime iso={p.scheduled_at} timeZone={p.location?.timezone ?? 'UTC'} className="text-xs text-orbit-muted" />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookImage className="h-5 w-5 text-orbit-primary" aria-hidden /> Image stock
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/library">
                Library <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data.image_stock.length ? (
              <p className="py-8 text-center text-sm text-orbit-muted">No active clients yet.</p>
            ) : (
              <ul className="space-y-4">
                {data.image_stock.map((st) => (
                  <li key={st.client.id} className="flex items-center gap-3">
                    <ClientAvatar client={st.client} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/library/${st.client.id}`} className="truncate text-sm font-bold text-orbit-heading hover:text-orbit-primary">
                          {st.client.name}
                        </Link>
                        <Badge variant={STOCK_BADGE[st.state]}>{st.unused} left</Badge>
                      </div>
                      <StockBar unused={st.unused} total={Math.max(st.total, st.threshold * 2)} state={st.state} className="mt-1.5 h-1.5" />
                      <p className="mt-1 text-[11px] text-orbit-muted">
                        {st.runs_out_at ? `${STOCK_LABEL[st.state]} · runs out ~${formatLocal(st.runs_out_at, 'MMM d')}` : STOCK_LABEL[st.state]}
                      </p>
                    </div>
                    {st.state !== 'ok' && (
                      <Button asChild size="icon-sm" variant="outline" aria-label={`Add images for ${st.client.name}`}>
                        <Link to={`/library/${st.client.id}`}>
                          <Upload />
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden /> Needs a post
              <span className="text-sm font-semibold text-orbit-muted">(no post in 7+ days)</span>
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/locations?staleDays=7">
                All {data.stale_count} <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data.stale_locations.length ? (
              <p className="py-8 text-center text-sm text-orbit-muted">Every active location posted in the last 7 days.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.stale_locations.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/locations/${l.id}`} className="block truncate text-sm font-bold text-orbit-heading hover:text-orbit-primary">
                        {l.title}
                      </Link>
                      <p className="flex items-center gap-2 text-xs text-orbit-muted">
                        <ClientDot client={l.client} className="text-xs font-medium" />
                        <span>{l.last_post_at ? `${daysSince(l.last_post_at)}d ago` : 'never posted'}</span>
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/compose?locations=${l.id}`}>
                        <Send /> Post
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/activity">
                All <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data.activity.length ? (
              <p className="py-8 text-center text-sm text-orbit-muted">No activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {data.activity.map((a) => (
                  <li key={a.id}>
                    <ActivityItem a={a} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {ui.elements}
    </>
  );
}
