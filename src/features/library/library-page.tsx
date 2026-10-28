import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookImage, CalendarClock, Upload } from 'lucide-react';
import type { ClientDTO, ClientStockDTO } from '../../../shared/types';
import { api } from '@/lib/api';
import { formatLocal, pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { ErrorState } from '@/components/app/error-state';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { STOCK_BADGE, STOCK_LABEL, StockBar } from './stock-bar';
import { UploadDialog } from './upload-dialog';

export function ClientAvatar({ client, size = 48 }: { client: Pick<ClientDTO, 'name' | 'color' | 'logo_url'>; size?: number }) {
  return client.logo_url ? (
    <img src={client.logo_url} alt="" className="shrink-0 rounded-2xl border border-orbit-line bg-white object-contain p-1" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-2xl font-extrabold text-white shadow-glow"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${client.color}, ${client.color}bb)`, fontSize: size * 0.38 }}
    >
      {client.name[0]?.toUpperCase()}
    </span>
  );
}

export function LibraryPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [uploadFor, setUploadFor] = useState<ClientDTO | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.library(showInactive),
    queryFn: () => api.get<ClientStockDTO[]>('/library', { all: showInactive ? '1' : undefined }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Images"
        title="Image Library"
        highlight="Library"
        description="Upload each client's photos once. Every auto-image post takes the next unused one, and branded graphics fill in when a library runs dry."
        actions={
          <div className="flex items-center gap-2">
            <Switch id="lib-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="lib-inactive">Show inactive clients</Label>
          </div>
        }
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={BookImage}
            title="No client libraries yet"
            description="Clients are created automatically when locations sync. Each client gets its own library."
            action={
              <Button asChild>
                <Link to="/connections">Connect Google accounts</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <li key={s.client.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <ClientAvatar client={s.client} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/library/${s.client.id}`} className="block truncate text-lg font-extrabold tracking-tightest text-orbit-heading hover:text-orbit-primary">
                      {s.client.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={STOCK_BADGE[s.state]}>{STOCK_LABEL[s.state]}</Badge>
                      {!s.client.is_active && <Badge variant="gray">Inactive</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span>
                      <strong className="text-2xl font-extrabold tracking-tightest text-orbit-heading">{s.unused}</strong>{' '}
                      <span className="text-orbit-muted">unused</span>
                    </span>
                    <span className="text-orbit-muted">{pluralize(s.total, 'image')} total</span>
                  </div>
                  <StockBar unused={s.unused} total={Math.max(s.total, s.threshold * 2)} state={s.state} />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-orbit-muted">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {s.runs_out_at
                    ? `Runs out around ${formatLocal(s.runs_out_at, 'MMM d')} (${pluralize(s.upcoming_auto_posts, 'upcoming post')})`
                    : s.upcoming_auto_posts
                      ? `Enough for ${pluralize(s.upcoming_auto_posts, 'upcoming post')}`
                      : 'No upcoming auto-image posts'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => setUploadFor(s.client)}>
                    <Upload /> Upload images
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/library/${s.client.id}`}>
                      Library &amp; brand kit <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <UploadDialog client={uploadFor} open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)} />
    </>
  );
}
