import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ImageIcon, Images, MapPin, Palette, Settings2, Trash2 } from 'lucide-react';
import type { LibraryExhaustedMode, LibraryImageDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { formatLocal, pluralize, timeAgo } from '@/lib/format';
import { useLocationOptions } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ErrorState } from '@/components/app/error-state';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandKitEditor } from './brand-kit-editor';
import { ClientAvatar } from './library-page';
import { STOCK_BADGE, STOCK_LABEL, StockBar } from './stock-bar';
import { LibraryDropzone } from './upload-dialog';
import { useClientLibrary, useDeleteImage, useSaveBrandKit, useUpdateImage } from './use-library';

type Filter = 'all' | 'unused' | 'used' | 'inactive';
const ALL_LOCATIONS = '__all__';

export function ClientLibraryPage() {
  const { clientId = '' } = useParams();
  const canManage = useHasRole('manager');
  const { data, isLoading, error, refetch } = useClientLibrary(clientId);
  const [filter, setFilter] = useState<Filter>('all');

  const images = useMemo(() => {
    const all = data?.images ?? [];
    if (filter === 'unused') return all.filter((i) => i.is_active && i.used_count === 0);
    if (filter === 'used') return all.filter((i) => i.used_count > 0);
    if (filter === 'inactive') return all.filter((i) => !i.is_active);
    return all;
  }, [data, filter]);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Card>
    );
  }
  const { stock } = data;
  const client = stock.client;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/library">
          <ArrowLeft /> All libraries
        </Link>
      </Button>
      <PageHeader eyebrow="Image library" title={client.name} description={`${pluralize(client.location_count, 'location')} · ${pluralize(stock.total, 'image')}`} />

      <Card className="mb-6 grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <ClientAvatar client={client} size={64} />
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <strong className="text-2xl font-extrabold tracking-tightest text-orbit-heading">{stock.unused}</strong>{' '}
              <span className="text-orbit-muted">unused of {stock.total}</span>
            </p>
            <Badge variant={STOCK_BADGE[stock.state]}>{STOCK_LABEL[stock.state]}</Badge>
            <span className="text-xs text-orbit-muted">Alert at {stock.threshold} or fewer</span>
          </div>
          <StockBar unused={stock.unused} total={Math.max(stock.total, stock.threshold * 2)} state={stock.state} />
          <p className="text-xs text-orbit-muted">
            {stock.runs_out_at
              ? `Projected to run out around ${formatLocal(stock.runs_out_at, 'MMM d, yyyy')} with ${pluralize(stock.upcoming_auto_posts, 'upcoming auto-image post')}. ${client.on_library_exhausted === 'recycle' ? 'Older images will be reused after that.' : 'Branded graphics will be used after that.'}`
              : `${pluralize(stock.upcoming_auto_posts, 'upcoming auto-image post')} covered by the library.`}
          </p>
        </div>
      </Card>

      <Tabs defaultValue="images">
        <TabsList>
          <TabsTrigger value="images">
            <Images /> Images
          </TabsTrigger>
          <TabsTrigger value="brand">
            <Palette /> Brand kit
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images">
          <Card className="p-4 sm:p-6">
            <LibraryDropzone client={client} compact />
            <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
              <Segmented<Filter>
                ariaLabel="Filter images"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All (${data.images.length})` },
                  { value: 'unused', label: 'Unused' },
                  { value: 'used', label: 'Used' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>
            {images.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title={data.images.length ? 'No images in this view' : 'No images yet'}
                description={data.images.length ? 'Try another filter.' : 'Drop photos above. Each auto-image post will use the next unused one.'}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {images.map((img) => (
                  <ImageTile key={img.id} image={img} clientId={client.id} canManage={canManage} />
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="brand">
          <Card className="p-4 sm:p-6">
            <BrandKitEditor client={client} canEdit={canManage} />
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="p-4 sm:p-6">
            <LibrarySettings clientId={client.id} mode={client.on_library_exhausted} threshold={client.low_stock_threshold} effectiveThreshold={stock.threshold} canEdit={canManage} />
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ImageTile({ image, clientId, canManage }: { image: LibraryImageDTO; clientId: string; canManage: boolean }) {
  const update = useUpdateImage(clientId);
  const del = useDeleteImage();
  const { data: locations = [] } = useLocationOptions();
  const clientLocations = locations.filter((l) => l.client?.id === clientId);
  const [confirm, setConfirm] = useState(false);
  const location = clientLocations.find((l) => l.id === image.location_id);
  return (
    <li className={cn('overflow-hidden rounded-2xl border border-orbit-line bg-white/80', !image.is_active && 'opacity-60')}>
      <div className="relative">
        <img src={image.public_url} alt={image.original_filename ?? ''} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        <span className="absolute left-2 top-2">
          {image.used_count === 0 ? (
            <Badge variant="emerald">Unused</Badge>
          ) : (
            <Badge variant="slate">Used ×{image.used_count}</Badge>
          )}
        </span>
        {!image.is_active && (
          <span className="absolute right-2 top-2">
            <Badge variant="gray">Inactive</Badge>
          </span>
        )}
      </div>
      <div className="grid gap-2 p-2.5">
        <p className="truncate text-xs font-semibold text-orbit-heading" title={image.original_filename ?? undefined}>
          {image.original_filename ?? 'Image'}
        </p>
        <p className="text-[11px] text-orbit-muted">
          {image.width}×{image.height}
          {image.last_used_at ? ` · used ${timeAgo(image.last_used_at)}` : ''}
        </p>
        {canManage && clientLocations.length > 1 ? (
          <Select
            value={image.location_id ?? ALL_LOCATIONS}
            onValueChange={(v) => update.mutate({ id: image.id, patch: { location_id: v === ALL_LOCATIONS ? null : v } })}
          >
            <SelectTrigger className="h-8 rounded-lg px-2 text-xs" aria-label="Location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
              {clientLocations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Only {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : location ? (
          <p className="flex items-center gap-1 truncate text-[11px] text-orbit-muted">
            <MapPin className="h-3 w-3" aria-hidden /> Only {location.title}
          </p>
        ) : null}
        {canManage && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => update.mutate({ id: image.id, patch: { is_active: !image.is_active } })}
            >
              {image.is_active ? <EyeOff /> : <Eye />}
              {image.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete image" onClick={() => setConfirm(true)}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this image?"
        description="It is removed from the library and storage. Images attached to unpublished posts cannot be deleted; deactivate them instead."
        confirmLabel="Delete image"
        destructive
        onConfirm={() => del.mutateAsync(image.id)}
      />
    </li>
  );
}

function LibrarySettings({
  clientId,
  mode,
  threshold,
  effectiveThreshold,
  canEdit,
}: {
  clientId: string;
  mode: LibraryExhaustedMode;
  threshold: number | null;
  effectiveThreshold: number;
  canEdit: boolean;
}) {
  const save = useSaveBrandKit(clientId);
  const [m, setM] = useState(mode);
  const [t, setT] = useState(threshold === null ? '' : String(threshold));
  useEffect(() => {
    setM(mode);
    setT(threshold === null ? '' : String(threshold));
  }, [mode, threshold]);
  const parsed = t.trim() === '' ? null : Number(t);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000);
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-2">
        <Label>When the library runs out</Label>
        <Segmented<LibraryExhaustedMode>
          ariaLabel="When the library runs out"
          value={m}
          onChange={setM}
          options={[
            { value: 'branded', label: 'Generate branded graphics' },
            { value: 'recycle', label: 'Reuse oldest images' },
          ]}
        />
        <p className="text-xs text-orbit-muted">
          {m === 'branded'
            ? 'Auto posts get a typographic graphic in your brand colours until new images are uploaded.'
            : 'Auto posts reuse the least recently used image until new images are uploaded.'}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="low-threshold">Low-stock alert threshold</Label>
        <Input id="low-threshold" type="number" min={0} max={1000} className="max-w-[160px]" value={t} placeholder={String(effectiveThreshold)} onChange={(e) => setT(e.target.value)} aria-invalid={!valid} />
        <p className="text-xs text-orbit-muted">Notify the team when this many unused images or fewer remain. Leave empty for the workspace default.</p>
      </div>
      {canEdit && (
        <Button className="justify-self-start" disabled={!valid || save.isPending || (m === mode && parsed === threshold)} onClick={() => save.mutate({ on_library_exhausted: m, low_stock_threshold: parsed })}>
          Save settings
        </Button>
      )}
    </div>
  );
}
