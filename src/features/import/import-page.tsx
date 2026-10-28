import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Download, FileSpreadsheet, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportStatus, ImportSummaryDTO, Paginated } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { formatLocal, pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/app/error-state';
import { Pagination } from '@/components/app/pagination';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { runImport, type ImportProgress } from './run-import';
import { downloadTemplate } from './sheet';

const SHEET = /\.(xlsx|xls|csv)$/i;
const ATTACHMENT = /\.(jpe?g|png|webp|heic|heif|zip)$/i;

export const IMPORT_STATUS: Record<ImportStatus, { label: string; variant: BadgeProps['variant'] }> = {
  validating: { label: 'Validating', variant: 'violet' },
  ready: { label: 'Ready to review', variant: 'amber' },
  committed: { label: 'Committed', variant: 'emerald' },
  discarded: { label: 'Discarded', variant: 'gray' },
};

function progressLabel(p: ImportProgress): string {
  switch (p.stage) {
    case 'parsing':
      return 'Reading the spreadsheet…';
    case 'validating':
      return 'Matching businesses and checking rows…';
    case 'uploading':
      return `Uploading images ${p.done}/${p.total}…`;
    case 'processing':
      return `Processing images ${p.done}/${p.total}…`;
    default:
      return 'Done';
  }
}

export function ImportPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: qk.imports(page),
    queryFn: () => api.get<Paginated<ImportSummaryDTO>>('/imports', { page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const sheets = files.filter((f) => SHEET.test(f.name));
    const others = files.filter((f) => !SHEET.test(f.name) && ATTACHMENT.test(f.name));
    const ignored = files.length - sheets.length - others.length;
    if (sheets.length > 1) toast.warning('Only one spreadsheet can be imported at a time; using the first one.');
    if (sheets[0]) setSheet(sheets[0]);
    if (others.length) setAttachments((cur) => [...cur, ...others]);
    if (ignored) toast.warning(`${pluralize(ignored, 'file')} ignored`, { description: 'Use XLSX/CSV for the sheet and JPG, PNG, WEBP, HEIC or ZIP for images.' });
  };

  const start = async () => {
    if (!sheet) return;
    try {
      const result = await runImport(sheet, attachments, setProgress);
      if (result.fileErrors.length) toast.warning('Some images could not be used', { description: result.fileErrors.slice(0, 4).join('\n'), duration: 10_000 });
      if (result.unusedFiles.length) toast.info(`${pluralize(result.unusedFiles.length, 'image')} not referenced by any row`, { description: result.unusedFiles.slice(0, 5).join(', ') });
      navigate(`/import/${result.id}`);
    } catch (err) {
      toast.error('Import failed', { description: errorMessage(err), duration: 10_000 });
      setProgress(null);
    }
  };

  const busy = !!progress && progress.stage !== 'done';

  return (
    <>
      <PageHeader
        eyebrow="Bulk import"
        title="Import Posts"
        highlight="Posts"
        description="Upload a spreadsheet, review how each row matched, then schedule everything in one go."
        actions={
          <Button variant="secondary" onClick={() => downloadTemplate()}>
            <Download /> Download template
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-4 sm:p-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-orbit-primary/30 bg-white/60 px-6 py-12 text-center transition hover:border-orbit-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
              drag && 'border-orbit-primary bg-orbit-primary/5',
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orbit-gradient text-white shadow-glow">
              <FileSpreadsheet className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-lg font-bold text-orbit-heading">Drop your spreadsheet here</span>
            <span className="max-w-md text-sm text-orbit-muted">
              XLSX or CSV. Add images named in the sheet's <code className="rounded bg-orbit-primary/10 px-1">image</code> column too (files or a ZIP).
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            accept=".xlsx,.xls,.csv,image/*,.heic,.heif,.zip"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {(sheet || attachments.length > 0) && (
            <ul className="mt-5 space-y-2">
              {sheet && (
                <li className="flex items-center gap-3 rounded-2xl border border-orbit-line bg-white/80 px-4 py-3">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" aria-hidden />
                  <span className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold text-orbit-heading">{sheet.name}</span>
                  <span className="text-xs text-orbit-muted">{(sheet.size / 1024).toFixed(0)} KB</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove spreadsheet" disabled={busy} onClick={() => setSheet(null)}>
                    <X />
                  </Button>
                </li>
              )}
              {attachments.length > 0 && (
                <li className="flex items-center gap-3 rounded-2xl border border-orbit-line bg-white/80 px-4 py-3">
                  <ImagePlus className="h-5 w-5 text-orbit-primary" aria-hidden />
                  <span className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold text-orbit-heading">
                    {pluralize(attachments.length, 'image file')} {attachments.some((f) => /\.zip$/i.test(f.name)) && '(ZIPs are unpacked)'}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove images" disabled={busy} onClick={() => setAttachments([])}>
                    <X />
                  </Button>
                </li>
              )}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" disabled={!sheet || busy} onClick={start}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              {busy ? progressLabel(progress!) : 'Upload & check'}
              {!busy && (
                <ButtonChip>
                  <ArrowRight />
                </ButtonChip>
              )}
            </Button>
            {!sheet && <p className="text-sm text-orbit-muted">Choose a spreadsheet to continue.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                ['Fill in the template', 'One row per post: business name, the Gmail that publishes it, and the text.'],
                ['Upload & check', 'Each row is matched to a location that Gmail can manage. Similar names are matched by fuzzy search; the city breaks ties.'],
                ['Review', 'Fix errors inline, pick the right location for rows that need review, and choose when unscheduled rows go out.'],
                ['Commit', 'Valid rows become posts (pending approval, or scheduled). Images are attached automatically.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orbit-gradient text-xs font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold text-orbit-heading">{title}</p>
                    <p className="text-orbit-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 p-3 sm:p-5">
        <h2 className="mb-3 px-1 text-lg">Past imports</h2>
        {history.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : !history.data?.items.length ? (
          <EmptyState icon={FileSpreadsheet} title="No imports yet" description="Your imports and their results will be listed here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.items.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => navigate(`/import/${i.id}`)}>
                    <TableCell className="max-w-xs">
                      <Link to={`/import/${i.id}`} className="block wrap-anywhere font-semibold text-orbit-heading hover:text-orbit-primary" onClick={(e) => e.stopPropagation()}>
                        {i.filename}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatLocal(i.created_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.total_rows}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{i.valid_rows}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">{i.review_rows}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-700">{i.error_rows}</TableCell>
                    <TableCell>
                      <Badge variant={IMPORT_STATUS[i.status].variant}>{IMPORT_STATUS[i.status].label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={10} total={history.data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
