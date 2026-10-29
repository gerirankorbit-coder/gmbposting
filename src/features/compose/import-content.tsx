import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportDetailDTO, ImportRowDTO, ImportSummaryDTO, LocationDTO, Paginated } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { formatLocal, pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { runImport } from '@/features/import/run-import';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ComposeState } from './compose-state';

const SHEET_ACCEPT = '.xlsx,.xls,.csv';

/** Rows of an import that carry post text, grouped by the location they matched. */
export function importRowsByLocation(detail: ImportDetailDTO | undefined): Map<string, ImportRowDTO[]> {
  const map = new Map<string, ImportRowDTO[]>();
  for (const r of detail?.rows ?? []) {
    const content = r.resolved?.content?.trim() || r.raw.post_content?.trim();
    if (!r.matched_location_id || !content) continue;
    map.set(r.matched_location_id, [...(map.get(r.matched_location_id) ?? []), r]);
  }
  return map;
}

export function rowContent(r: ImportRowDTO): string {
  return (r.resolved?.content?.trim() || r.raw.post_content?.trim()) ?? '';
}

const detailQuery = (id: string) => ({
  queryKey: qk.importDetail(id),
  queryFn: () => api.get<ImportDetailDTO>(`/imports/${id}`),
});

export function useImportDetail(importId: string | null) {
  return useQuery({ ...detailQuery(importId ?? 'none'), enabled: !!importId });
}

/**
 * Pick (or upload) a spreadsheet and fill each selected location's post with the text of its
 * matching row. The texts stay editable below.
 */
export function ImportContentPanel({
  state,
  patch,
  locById,
}: {
  state: ComposeState;
  patch: (p: Partial<ComposeState>) => void;
  locById: Map<string, LocationDTO>;
}) {
  const importId = state.importId;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const list = useQuery({
    queryKey: qk.imports(1),
    queryFn: () =>
      api.get<Paginated<ImportSummaryDTO>>('/imports', {
        page: 1,
        pageSize: 25,
      }),
  });
  const detail = useImportDetail(importId);
  const byLoc = useMemo(() => importRowsByLocation(detail.data), [detail.data]);

  const [choosing, setChoosing] = useState(false);

  /** Selecting a sheet fills every matched location's text (once; later edits are kept). */
  const choose = async (id: string) => {
    setChoosing(true);
    try {
      const data = await qc.fetchQuery(detailQuery(id));
      const rows = importRowsByLocation(data);
      const next = { ...state.variations };
      let filled = 0;
      for (const locId of state.selected) {
        const row = rows.get(locId)?.[0];
        if (row) {
          next[locId] = rowContent(row);
          filled++;
        }
      }
      patch({ importId: id, variations: next });
      const missing = state.selected.length - filled;
      if (filled) {
        toast.success(`Filled ${filled} of ${pluralize(state.selected.length, 'location')} from ${data.import.filename}`, {
          description: missing ? `${pluralize(missing, 'location')} had no row in this sheet; write those below.` : undefined,
        });
      } else {
        toast.warning('None of the selected locations is in this sheet', {
          description: 'Pick another sheet or write the posts below.',
        });
      }
    } catch (err) {
      toast.error('Could not load the sheet', {
        description: errorMessage(err),
      });
    } finally {
      setChoosing(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const result = await runImport(file, [], () => {});
      await qc.invalidateQueries({ queryKey: qk.importsAll });
      await choose(result.id);
    } catch (err) {
      toast.error('Could not read the sheet', {
        description: errorMessage(err),
        duration: 10_000,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const options = list.data?.items ?? [];
  const matched = state.selected.filter((id) => byLoc.has(id)).length;
  const missing = state.selected.filter((id) => !byLoc.has(id));

  return (
    <div className="grid gap-4 rounded-3xl border border-orbit-line bg-white/60 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="import-sheet">Sheet</Label>
          <Select value={importId ?? undefined} onValueChange={(v) => void choose(v)} disabled={list.isLoading || choosing}>
            <SelectTrigger id="import-sheet">
              <SelectValue
                placeholder={
                  list.isLoading ? 'Loading sheets…' : options.length ? 'Choose an uploaded sheet' : 'No sheets yet: upload one'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.filename} · {pluralize(i.total_rows, 'row')} · {formatLocal(i.created_at, 'MMM d')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={SHEET_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading || choosing}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload new sheet
        </Button>
      </div>
      <p className="text-xs text-orbit-muted">
        Uses the <span className="font-semibold">post_content</span> of the row that matches each selected location (by
        location_id or business name, same as the Import page). Only the text is taken; image, button and schedule come from the
        other steps.
      </p>
      {(choosing || uploading) && (
        <p className="flex items-center gap-2 text-sm text-orbit-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{' '}
          {uploading ? 'Uploading and matching the sheet…' : 'Reading the sheet…'}
        </p>
      )}
      {detail.data && (
        <div className="flex items-start gap-2 rounded-2xl bg-orbit-primary/5 p-3 text-sm">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-orbit-primary" aria-hidden />
          <p className="wrap-anywhere text-orbit-body">
            <span className="font-semibold text-orbit-heading">
              {matched} of {state.selected.length}
            </span>{' '}
            selected locations found in {detail.data.import.filename}.
            {missing.length > 0 && <> Not in the sheet: {missing.map((id) => locById.get(id)?.title ?? 'Unknown').join(', ')}.</>}
          </p>
        </div>
      )}
    </div>
  );
}

/** When a location has several rows in the sheet, lets the user choose which one to use. */
export function ImportRowPicker({
  rows,
  value,
  onPick,
}: {
  rows: ImportRowDTO[];
  value: string;
  onPick: (text: string) => void;
}) {
  if (rows.length < 2) return rows[0] ? <span className="text-xs text-orbit-muted">Row {rows[0].row_number}</span> : null;
  const current = rows.find((r) => rowContent(r) === value.trim());
  return (
    <Select value={current?.id} onValueChange={(id) => onPick(rowContent(rows.find((r) => r.id === id)!))}>
      <SelectTrigger className="h-9 w-36" aria-label="Sheet row">
        <SelectValue placeholder="Edited" />
      </SelectTrigger>
      <SelectContent>
        {rows.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            Row {r.row_number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
