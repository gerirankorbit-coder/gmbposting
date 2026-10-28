import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Download,
  ImageIcon,
  Loader2,
  Pencil,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ImportOptions, ImportRowDTO, ImportRowStatus } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { api, errorMessage } from '@/lib/api';
import { formatLocal, pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ErrorState } from '@/components/app/error-state';
import { ZonedTime } from '@/components/app/zoned-time';
import { PageHeader } from '@/components/layout/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IMPORT_STATUS } from './import-page';
import { RowEditDialog } from './row-edit-dialog';
import { downloadErrorRows } from './sheet';
import { useCommitImport, useDiscardImport, useImportDetail, useUpdateImportOptions, useUpdateImportRow } from './use-imports';

type Filter = 'all' | ImportRowStatus;

const STATUS_ICON: Record<ImportRowStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-600', label: 'Ready' },
  needs_review: { icon: AlertTriangle, className: 'text-amber-500', label: 'Needs review' },
  error: { icon: AlertCircle, className: 'text-rose-600', label: 'Error' },
};

export function ImportPreviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canApprove = useHasRole('manager');
  const { data, isLoading, error, refetch } = useImportDetail(id);
  const updateRow = useUpdateImportRow(id);
  const commit = useCommitImport(id);
  const discard = useDiscardImport(id);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ImportRowDTO | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null);
  const processingRef = useRef(false);

  // Download image URLs from the sheet in time-boxed batches until none are pending.
  const pending = data?.import.pending_images ?? 0;
  const editable = data?.import.status === 'ready';
  useEffect(() => {
    if (!editable || !pending || processingRef.current) return;
    processingRef.current = true;
    const total = pending;
    let done = 0;
    setImageProgress({ done, total });
    void (async () => {
      try {
        for (let guard = 0; guard < 50; guard++) {
          const r = await api.post<{ processed: number; failed: number; remaining: number }>(`/imports/${id}/process-images`);
          done += r.processed;
          setImageProgress({ done: Math.min(done, total), total });
          if (!r.remaining || !r.processed) break;
        }
      } catch (err) {
        toast.error('Image download stopped', { description: errorMessage(err) });
      } finally {
        processingRef.current = false;
        setImageProgress(null);
        void qc.invalidateQueries({ queryKey: qk.importDetail(id) });
      }
    })();
  }, [editable, pending, id, qc]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!q || `${r.raw.business_name ?? ''} ${r.raw.gmail ?? ''} ${r.raw.post_content ?? ''} ${r.resolved?.location_title ?? ''}`.toLowerCase().includes(q)),
    );
  }, [data, filter, search]);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load this import" />
      </Card>
    );
  }
  const imp = data.import;
  const counts = {
    all: data.rows.length,
    ok: data.rows.filter((r) => r.status === 'ok').length,
    needs_review: data.rows.filter((r) => r.status === 'needs_review').length,
    error: data.rows.filter((r) => r.status === 'error').length,
  };

  const doCommit = (mode: 'submit' | 'approve') =>
    commit.mutate(mode, {
      onSuccess: (r) => {
        toast.success(`${pluralize(r.created, 'post')} created`, {
          description: r.status === 'pending_approval' ? 'They are waiting for approval.' : 'They are scheduled to publish.',
        });
        void refetch();
      },
    });

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/import">
          <ArrowLeft /> All imports
        </Link>
      </Button>
      <PageHeader
        eyebrow={`Import · ${formatLocal(imp.created_at)}`}
        title={imp.filename}
        description={<Badge variant={IMPORT_STATUS[imp.status].variant}>{IMPORT_STATUS[imp.status].label}</Badge>}
        actions={
          <>
            {counts.error + counts.needs_review > 0 && (
              <Button variant="outline" onClick={() => downloadErrorRows(imp.filename, data.rows.filter((r) => r.status !== 'ok'))}>
                <Download /> Download error rows
              </Button>
            )}
            {editable && (
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirmDiscard(true)}>
                <Trash2 /> Discard
              </Button>
            )}
          </>
        }
      />

      {imp.status === 'committed' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <p className="flex-1 text-sm font-semibold">
            Committed: {pluralize(data.rows.filter((r) => r.post_id).length, 'post')} created from this sheet.
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link to={`/queue?importId=${imp.id}`}>View posts</Link>
          </Button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['all', 'Rows', counts.all, 'text-orbit-heading'],
            ['ok', 'Ready', counts.ok, 'text-emerald-600'],
            ['needs_review', 'Need review', counts.needs_review, 'text-amber-600'],
            ['error', 'Errors', counts.error, 'text-rose-600'],
          ] as const
        ).map(([key, label, value, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn('glass-card p-4 text-left transition hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60', filter === key && 'ring-2 ring-orbit-primary/40')}
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-orbit-muted">{label}</p>
            <p className={cn('mt-1 text-3xl font-extrabold tracking-tightest', tone)}>{value}</p>
          </button>
        ))}
      </div>

      {imageProgress && (
        <Card className="mb-6 flex items-center gap-3 p-4" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-orbit-primary" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orbit-heading">
              Downloading images from the sheet… {imageProgress.done}/{imageProgress.total}
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-orbit-primary/10">
              <div className="h-full rounded-full bg-orbit-gradient transition-all" style={{ width: `${Math.max(5, (imageProgress.done / imageProgress.total) * 100)}%` }} />
            </div>
          </div>
        </Card>
      )}

      {editable && <ScheduleOptions importId={id} options={imp.options} />}

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Segmented<Filter>
            ariaLabel="Filter rows"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All (${counts.all})` },
              { value: 'ok', label: `Ready (${counts.ok})` },
              { value: 'needs_review', label: `Review (${counts.needs_review})` },
              { value: 'error', label: `Errors (${counts.error})` },
            ]}
          />
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows…" className="pl-9" aria-label="Search rows" />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-orbit-muted">No rows in this view.</p>
        ) : (
          <ul className="divide-y divide-orbit-line">
            {rows.map((r) => (
              <ImportRowItem
                key={r.id}
                row={r}
                editable={editable}
                busy={updateRow.isPending && updateRow.variables?.rowId === r.id}
                onEdit={() => setEditing(r)}
                onPick={(locationId) => updateRow.mutate({ rowId: r.id, patch: { location_id: locationId } })}
              />
            ))}
          </ul>
        )}
      </Card>

      {editable && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-col gap-3 rounded-3xl bg-white/90 p-4 shadow-glow backdrop-blur-xl sm:flex-row sm:items-center">
          <p className="text-sm text-orbit-body sm:mr-auto">
            <strong className="text-orbit-heading">{pluralize(counts.ok, 'row')}</strong> will become posts.
            {counts.needs_review + counts.error > 0 && ` ${counts.needs_review + counts.error} other row${counts.needs_review + counts.error === 1 ? ' is' : 's are'} skipped.`}
          </p>
          <Button variant={canApprove ? 'secondary' : 'default'} disabled={!counts.ok || commit.isPending || !!imageProgress} onClick={() => doCommit('submit')}>
            {commit.isPending && commit.variables === 'submit' ? <Loader2 className="animate-spin" /> : <Send />}
            Commit valid rows
          </Button>
          {canApprove && (
            <Button disabled={!counts.ok || commit.isPending || !!imageProgress} onClick={() => doCommit('approve')}>
              {commit.isPending && commit.variables === 'approve' ? <Loader2 className="animate-spin" /> : <CheckCheck />}
              Approve &amp; schedule all
            </Button>
          )}
        </div>
      )}

      <RowEditDialog importId={id} row={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this import?"
        description="No posts are created and images processed for it are removed."
        confirmLabel="Discard import"
        destructive
        onConfirm={async () => {
          await discard.mutateAsync();
          navigate('/import');
        }}
      />
    </>
  );
}

function ScheduleOptions({ importId, options }: { importId: string; options: ImportOptions }) {
  const save = useUpdateImportOptions(importId);
  const [draft, setDraft] = useState(options);
  useEffect(() => setDraft(options), [options]);
  const today = new Date().toISOString().slice(0, 10);
  const changed = JSON.stringify(draft) !== JSON.stringify(options);
  const valid = draft.schedule === 'asap' || (!!draft.spreadStart && !!draft.spreadEnd && draft.spreadEnd >= draft.spreadStart);
  return (
    <Card className="mb-6 grid gap-4 p-4 sm:p-5">
      <div>
        <h2 className="text-base">Rows without a date</h2>
        <p className="text-sm text-orbit-muted">Rows with a schedule_date keep their own time.</p>
      </div>
      <Segmented<ImportOptions['schedule']>
        ariaLabel="Rows without a date"
        value={draft.schedule}
        onChange={(v) =>
          setDraft({
            ...draft,
            schedule: v,
            spreadStart: draft.spreadStart ?? today,
            spreadEnd: draft.spreadEnd ?? new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
          })
        }
        options={[
          { value: 'asap', label: 'Publish ASAP' },
          { value: 'spread', label: 'Spread across dates' },
        ]}
      />
      {draft.schedule === 'spread' && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="imp-from">From</Label>
            <Input id="imp-from" type="date" value={draft.spreadStart ?? ''} onChange={(e) => setDraft({ ...draft, spreadStart: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="imp-to">To</Label>
            <Input id="imp-to" type="date" value={draft.spreadEnd ?? ''} onChange={(e) => setDraft({ ...draft, spreadEnd: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="imp-start-hour">Between</Label>
            <Select value={String(draft.startHour)} onValueChange={(v) => setDraft({ ...draft, startHour: Number(v) })}>
              <SelectTrigger id="imp-start-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 23 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="imp-end-hour">And</Label>
            <Select value={String(draft.endHour)} onValueChange={(v) => setDraft({ ...draft, endHour: Number(v) })}>
              <SelectTrigger id="imp-end-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h % 24).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-orbit-muted sm:col-span-4">Evenly spread in each location's time zone, at most one post per location per day.</p>
        </div>
      )}
      {changed && (
        <Button className="justify-self-start" size="sm" disabled={!valid || save.isPending || draft.endHour <= draft.startHour} onClick={() => save.mutate(draft)}>
          {save.isPending && <Loader2 className="animate-spin" />} Apply schedule
        </Button>
      )}
    </Card>
  );
}

function ImportRowItem({
  row: r,
  editable,
  busy,
  onEdit,
  onPick,
}: {
  row: ImportRowDTO;
  editable: boolean;
  busy: boolean;
  onEdit: () => void;
  onPick: (locationId: string) => void;
}) {
  const meta = STATUS_ICON[r.status];
  const Icon = meta.icon;
  const res = r.resolved;
  const image = res?.image;
  const content = r.raw.post_content ?? '';
  return (
    <li className={cn('grid gap-3 py-4 lg:grid-cols-[28px_minmax(0,1.1fr)_minmax(0,1.6fr)_120px_170px_auto] lg:items-start', busy && 'opacity-60')}>
      <span className="flex items-center gap-2 lg:block">
        <Icon className={cn('h-5 w-5', meta.className)} aria-label={meta.label} />
        <span className="text-xs font-semibold text-orbit-muted lg:mt-1 lg:block">#{r.row_number}</span>
      </span>

      <div className="min-w-0">
        {res?.location_title ? (
          <>
            <p className="truncate text-sm font-bold text-orbit-heading">{res.location_title}</p>
            <p className="truncate text-xs text-orbit-muted">{[res.location_city, res.client_name].filter(Boolean).join(' · ')}</p>
          </>
        ) : (
          <p className="truncate text-sm font-bold text-orbit-heading">{r.raw.business_name ?? r.raw.location_id ?? '—'}</p>
        )}
        <p className="truncate text-xs text-orbit-muted">{r.raw.gmail ?? 'No Gmail'}</p>
        {r.status === 'needs_review' && r.candidates.length > 0 && editable && (
          <Select onValueChange={onPick} disabled={busy}>
            <SelectTrigger className="mt-2 h-9 border-amber-300 bg-amber-50/60 text-xs" aria-label={`Choose location for row ${r.row_number}`}>
              <SelectValue placeholder="Choose the right location…" />
            </SelectTrigger>
            <SelectContent>
              {r.candidates.map((c) => (
                <SelectItem key={c.location_id} value={c.location_id}>
                  {c.title}
                  {c.city ? ` · ${c.city}` : ''} ({Math.round(c.score * 100)}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="min-w-0">
        {res?.topic_type && res.topic_type !== 'STANDARD' && (
          <p className="text-xs font-bold uppercase tracking-wide text-orbit-primary">
            {res.topic_type === 'OFFER' ? 'Offer' : 'Event'}
            {res.event_title ? ` · ${res.event_title}` : ''}
          </p>
        )}
        <p className="line-clamp-2 text-sm text-orbit-body">{content || <span className="italic text-orbit-muted">No content</span>}</p>
        <p className={cn('text-[11px] font-semibold tabular-nums', content.length > 1500 ? 'text-rose-600' : 'text-orbit-muted')}>{content.length} / 1500</p>
        {r.errors.map((e) => (
          <p key={e} className="mt-1 flex items-start gap-1.5 text-xs font-medium text-rose-600">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {e}
          </p>
        ))}
        {r.warnings.map((w) => (
          <p key={w} className="mt-1 flex items-start gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {w}
          </p>
        ))}
      </div>

      <div>
        {image?.status === 'ready' && image.url ? (
          <img src={image.url} alt="" loading="lazy" className="h-16 w-24 rounded-xl object-cover" />
        ) : image?.status === 'pending' ? (
          <Badge variant="violet">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {image.kind === 'file' ? 'Waiting' : 'Downloading'}
          </Badge>
        ) : image?.kind === 'none' ? (
          <Badge variant="gray">
            <ImageIcon className="h-3 w-3" aria-hidden /> No image
          </Badge>
        ) : (
          <Badge variant="violet">
            <Sparkles className="h-3 w-3" aria-hidden /> Auto
          </Badge>
        )}
      </div>

      <div className="text-sm">
        {r.status === 'error' ? (
          <span className="text-orbit-muted">—</span>
        ) : r.planned_at && res?.timezone ? (
          <ZonedTime iso={r.planned_at} timeZone={res.timezone} />
        ) : (
          <span className="font-semibold text-orbit-heading">ASAP</span>
        )}
      </div>

      <div className="flex lg:justify-end">
        {editable && !r.post_id && (
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
            <Pencil /> Edit
          </Button>
        )}
        {r.post_id && <Badge variant="emerald">Post created</Badge>}
      </div>
    </li>
  );
}
