import { format } from 'date-fns';
import { mapRow, isBlankRow, type ImportRawRow } from '../../shared/import.js';
import type { PostDraft } from '../../shared/schemas.js';
import { spreadSchedule } from '../../shared/schedule.js';
import {
  DEFAULT_IMPORT_OPTIONS,
  type ImportCandidate,
  type ImportDetailDTO,
  type ImportOptions,
  type ImportRowDTO,
  type ImportRowResolved,
  type ImportSummaryDTO,
} from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { chunk, unwrap, unwrapOne } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import type { ImportRow, ImportRowRow, Json } from '../db/types.js';
import { badRequest, conflict } from '../lib/errors.js';
import { downloadObject, removeObjects } from '../lib/storage.js';
import { notify } from '../notify/index.js';
import { processImage } from '../images/process.js';
import { storeProcessed } from '../images/incoming.js';
import { createPosts } from '../posts/create.js';
import { loadMatchContext, type MatchContext } from './context.js';
import { importImageFromUrl } from './images.js';
import { flagDuplicates, validateRow, type ValidatedRow } from './validate.js';

const asJson = (v: unknown) => v as Json;

export function readOptions(raw: Json): ImportOptions {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<ImportOptions>;
  return { ...DEFAULT_IMPORT_OPTIONS, ...o };
}

function rowFields(v: ValidatedRow) {
  return {
    resolved: asJson(v.resolved),
    candidates: asJson(v.candidates),
    matched_location_id: v.matched_location_id,
    matched_connection_id: v.matched_connection_id,
    match_confidence: v.match_confidence,
    status: v.status,
    errors: v.errors,
    warnings: v.warnings,
  };
}

async function refreshCounts(importId: string): Promise<void> {
  const rows = unwrap(await db().from('import_rows').select('status').eq('import_id', importId), 'Count rows');
  unwrap(
    await db()
      .from('imports')
      .update({
        total_rows: rows.length,
        valid_rows: rows.filter((r) => r.status === 'ok').length,
        error_rows: rows.filter((r) => r.status === 'error').length,
      })
      .eq('id', importId),
    'Update counts',
  );
}

async function loadImport(id: string): Promise<ImportRow> {
  return unwrapOne(await db().from('imports').select('*').eq('id', id).maybeSingle(), 'Import');
}

function assertEditable(imp: ImportRow) {
  if (imp.status === 'committed') throw conflict('This import was already committed.');
  if (imp.status === 'discarded') throw conflict('This import was discarded.');
}

/** Validates every row and stores the import for preview. */
export async function createImport(filename: string, sheetRows: Record<string, string>[], userId: string): Promise<string> {
  const mapped = sheetRows
    .map((r, i) => ({ row_number: i + 2, raw: mapRow(r) }))
    .filter((r) => !isBlankRow(r.raw));
  if (!mapped.length) throw badRequest('The sheet has no rows with data. Check that the first row contains the column headers.');
  if (!mapped.some((r) => r.raw.business_name || r.raw.location_id) || !mapped.some((r) => r.raw.post_content)) {
    throw badRequest('Could not find the business_name and post_content columns. Download the template to see the expected headers.');
  }

  const ctx = await loadMatchContext();
  const validated = mapped.map((r) => ({ row_number: r.row_number, raw: r.raw, v: validateRow(r.raw, ctx) }));
  flagDuplicates(validated);

  const imp = unwrapOne(
    await db()
      .from('imports')
      .insert({ filename, uploaded_by: userId, status: 'validating', options: asJson(DEFAULT_IMPORT_OPTIONS) })
      .select('id')
      .single(),
    'Create import',
  );
  for (const part of chunk(validated, 300)) {
    unwrap(
      await db()
        .from('import_rows')
        .insert(part.map((r) => ({ import_id: imp.id, row_number: r.row_number, raw: asJson(r.raw), ...rowFields(r.v) }))),
      'Save rows',
    );
  }
  unwrap(await db().from('imports').update({ status: 'ready' }).eq('id', imp.id), 'Mark ready');
  await refreshCounts(imp.id);

  const ok = validated.filter((r) => r.v.status === 'ok').length;
  const review = validated.filter((r) => r.v.status === 'needs_review').length;
  const errors = validated.length - ok - review;
  await notify({
    type: 'import_ready',
    title: `Import ready: ${filename}`,
    body: `${ok} ready, ${review} to review, ${errors} with errors.`,
    link: `/import/${imp.id}`,
  });
  await logActivity({ actor: userId, action: 'import.created', entityType: 'import', entityId: imp.id, details: { filename, rows: validated.length, ok, review, errors } });
  return imp.id;
}

/** Publish times for the preview and commit: explicit sheet time, else the import option. */
export function planTimes(rows: ImportRowRow[], options: ImportOptions): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const unscheduled: ImportRowRow[] = [];
  for (const r of [...rows].sort((a, b) => a.row_number - b.row_number)) {
    const res = r.resolved as unknown as ImportRowResolved | null;
    if (r.status === 'error' || !res) continue;
    if (res.scheduled_at) out.set(r.id, res.scheduled_at);
    else if (options.schedule === 'spread' && r.matched_location_id && res.timezone) unscheduled.push(r);
    else out.set(r.id, null);
  }
  if (unscheduled.length && options.spreadStart && options.spreadEnd) {
    const times = spreadSchedule(
      unscheduled.map((r) => ({ key: r.matched_location_id!, timeZone: (r.resolved as unknown as ImportRowResolved).timezone! })),
      { startDate: options.spreadStart, endDate: options.spreadEnd, startHour: options.startHour, endHour: options.endHour },
    );
    unscheduled.forEach((r, i) => out.set(r.id, times[i] ?? null));
  }
  return out;
}

async function loadRows(importId: string): Promise<ImportRowRow[]> {
  const rows: ImportRowRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = unwrap(
      await db().from('import_rows').select('*').eq('import_id', importId).order('row_number').range(from, from + 999),
      'Load rows',
    );
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function pendingImages(rows: ImportRowRow[]): number {
  return rows.filter((r) => (r.resolved as unknown as ImportRowResolved | null)?.image?.status === 'pending' && r.status !== 'error').length;
}

export function toSummary(imp: ImportRow, rows?: ImportRowRow[]): ImportSummaryDTO {
  return {
    id: imp.id,
    filename: imp.filename,
    uploaded_by: imp.uploaded_by,
    total_rows: imp.total_rows,
    valid_rows: imp.valid_rows,
    error_rows: imp.error_rows,
    review_rows: Math.max(0, imp.total_rows - imp.valid_rows - imp.error_rows),
    status: imp.status,
    options: readOptions(imp.options),
    campaign_id: imp.campaign_id,
    created_at: imp.created_at,
    pending_images: rows ? pendingImages(rows) : 0,
  };
}

export async function getImportDetail(id: string): Promise<ImportDetailDTO> {
  const imp = await loadImport(id);
  const rows = await loadRows(id);
  const planned = planTimes(rows, readOptions(imp.options));
  const dtoRows: ImportRowDTO[] = rows.map((r) => ({
    id: r.id,
    row_number: r.row_number,
    raw: r.raw as Record<string, string>,
    resolved: r.resolved as unknown as ImportRowResolved | null,
    candidates: (r.candidates as unknown as ImportCandidate[]) ?? [],
    matched_location_id: r.matched_location_id,
    matched_connection_id: r.matched_connection_id,
    match_confidence: r.match_confidence,
    status: r.status,
    errors: r.errors,
    warnings: r.warnings,
    post_id: r.post_id,
    planned_at: planned.get(r.id) ?? null,
  }));
  return { import: toSummary(imp, rows), rows: dtoRows };
}

/** Re-validates rows (e.g. after an edit), keeping processed images and re-checking duplicates. */
async function revalidate(importId: string, ctx: MatchContext, changed: ImportRowRow[]): Promise<void> {
  const all = await loadRows(importId);
  const changedIds = new Set(changed.map((r) => r.id));
  const merged = all.map((r) => changed.find((c) => c.id === r.id) ?? r);
  const validated = merged.map((r) => ({
    row: r,
    row_number: r.row_number,
    v: validateRow(r.raw as ImportRawRow, ctx, (r.resolved as unknown as ImportRowResolved | null)?.image),
  }));
  flagDuplicates(validated);
  for (const { row, v } of validated) {
    const before = JSON.stringify([row.status, row.errors, row.warnings, row.resolved, row.matched_location_id]);
    const after = JSON.stringify([v.status, v.errors, v.warnings, v.resolved, v.matched_location_id]);
    if (changedIds.has(row.id) || before !== after) {
      unwrap(await db().from('import_rows').update({ raw: row.raw, ...rowFields(v) }).eq('id', row.id), 'Update row');
    }
  }
  await refreshCounts(importId);
}

export async function updateRow(
  importId: string,
  rowId: string,
  patch: { location_id?: string; gmail?: string; post_content?: string; schedule_date?: string; schedule_time?: string; image?: string },
): Promise<void> {
  assertEditable(await loadImport(importId));
  const row = unwrapOne(await db().from('import_rows').select('*').eq('id', rowId).eq('import_id', importId).maybeSingle(), 'Row');
  const raw = { ...(row.raw as ImportRawRow) };
  const ctx = await loadMatchContext();
  if (patch.location_id) {
    const loc = ctx.locations.get(patch.location_id);
    if (!loc) throw badRequest('That location does not exist.');
    raw.location_id = loc.location_name;
  }
  for (const key of ['gmail', 'post_content', 'schedule_date', 'schedule_time', 'image'] as const) {
    if (patch[key] !== undefined) {
      const value = patch[key]!.trim();
      if (value) raw[key] = value;
      else delete raw[key];
    }
  }
  await revalidate(importId, ctx, [{ ...row, raw: asJson(raw) }]);
}

export async function updateOptions(importId: string, options: ImportOptions): Promise<void> {
  assertEditable(await loadImport(importId));
  unwrap(await db().from('imports').update({ options: asJson(options) }).eq('id', importId), 'Save options');
}

const baseName = (name: string) => name.split(/[\\/]/).pop()!.trim().toLowerCase();

/** Processes up to 5 uploaded files and attaches them to rows whose `image` names them. */
export async function attachFiles(importId: string, files: { filename: string; path: string }[]): Promise<{ attached: number; unused: string[]; errors: string[] }> {
  assertEditable(await loadImport(importId));
  const rows = (await loadRows(importId)).filter((r) => {
    const img = (r.resolved as unknown as ImportRowResolved | null)?.image;
    return img?.kind === 'file';
  });
  const result = { attached: 0, unused: [] as string[], errors: [] as string[] };
  for (const f of files) {
    const targets = rows.filter((r) => baseName((r.resolved as unknown as ImportRowResolved).image.ref ?? '') === baseName(f.filename));
    try {
      if (!targets.length) {
        result.unused.push(f.filename);
        continue;
      }
      const stored = await storeProcessed('uploads', await processImage(await downloadObject(f.path)));
      for (const r of targets) {
        const res = r.resolved as unknown as ImportRowResolved;
        res.image = { ...res.image, status: 'ready', url: stored.url, path: stored.path, error: null };
        unwrap(await db().from('import_rows').update({ resolved: asJson(res) }).eq('id', r.id), 'Attach image');
        result.attached++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'could not be processed';
      result.errors.push(`${f.filename}: ${message}`);
      for (const r of targets) await markImageFailed(r, message);
    } finally {
      await removeObjects([f.path]);
    }
  }
  return result;
}

async function markImageFailed(r: ImportRowRow, message: string) {
  const res = r.resolved as unknown as ImportRowResolved;
  res.image = { ...res.image, status: 'failed', error: message };
  const warnings = [...r.warnings.filter((w) => !w.startsWith('Image could not be used')), `Image could not be used (${message}); Auto will be used instead.`];
  unwrap(await db().from('import_rows').update({ resolved: asJson(res), warnings }).eq('id', r.id), 'Mark image failed');
}

/** After all files are uploaded: rows still waiting for a file fall back to Auto. */
export async function finishFiles(importId: string): Promise<number> {
  const rows = (await loadRows(importId)).filter((r) => {
    const img = (r.resolved as unknown as ImportRowResolved | null)?.image;
    return img?.kind === 'file' && img.status === 'pending';
  });
  for (const r of rows) {
    await markImageFailed(r, `no uploaded file named "${(r.resolved as unknown as ImportRowResolved).image.ref}"`);
  }
  return rows.length;
}

/** Downloads pending image URLs within a time budget; call repeatedly until `remaining` is 0. */
export async function processUrlImages(importId: string, budgetMs = 40_000): Promise<{ processed: number; failed: number; remaining: number }> {
  const started = Date.now();
  const pending = (await loadRows(importId)).filter((r) => {
    const img = (r.resolved as unknown as ImportRowResolved | null)?.image;
    return img?.kind === 'url' && img.status === 'pending' && r.status !== 'error';
  });
  let processed = 0;
  let failed = 0;
  const cache = new Map<string, { url: string; path: string } | Error>();
  for (const r of pending) {
    if (Date.now() - started > budgetMs) break;
    const res = r.resolved as unknown as ImportRowResolved;
    const ref = res.image.ref!;
    let outcome = cache.get(ref);
    if (!outcome) {
      outcome = await importImageFromUrl(ref).catch((err: unknown) => (err instanceof Error ? err : new Error('Download failed')));
      cache.set(ref, outcome);
    }
    if (outcome instanceof Error) {
      await markImageFailed(r, outcome.message);
      failed++;
    } else {
      res.image = { ...res.image, status: 'ready', url: outcome.url, path: outcome.path, error: null };
      unwrap(await db().from('import_rows').update({ resolved: asJson(res) }).eq('id', r.id), 'Save image');
    }
    processed++;
  }
  return { processed, failed, remaining: pending.length - processed };
}

/** Creates posts for every `ok` row and links them back to the import. */
export async function commitImport(importId: string, mode: 'submit' | 'approve', userId: string): Promise<{ created: number; campaignId: string; status: string }> {
  const imp = await loadImport(importId);
  assertEditable(imp);
  const rows = await loadRows(importId);
  const ok = rows.filter((r) => r.status === 'ok');
  if (!ok.length) throw badRequest('There are no valid rows to commit. Fix errors or resolve rows that need review first.');
  const planned = planTimes(rows, readOptions(imp.options));

  const drafts: PostDraft[] = ok.map((r) => {
    const res = r.resolved as unknown as ImportRowResolved;
    const imageReady = res.image.status === 'ready' && !!res.image.url;
    const imageSource = res.image.kind === 'none' ? 'none' : imageReady && (res.image.kind === 'url' || res.image.kind === 'file') ? 'upload' : 'auto';
    return {
      location_id: r.matched_location_id!,
      connection_id: r.matched_connection_id!,
      topic_type: res.topic_type,
      summary: res.content,
      cta_type: res.cta_type,
      cta_url: res.cta_type && res.cta_type !== 'CALL' ? res.cta_url : null,
      image_source: imageSource,
      media_url: imageSource === 'upload' ? res.image.url : null,
      media_path: imageSource === 'upload' ? res.image.path : null,
      image_library_id: null,
      event_title: res.event_title,
      event_start: res.event_start,
      event_end: res.event_end,
      offer_coupon_code: res.coupon_code,
      offer_redeem_url: res.redeem_url,
      offer_terms: res.offer_terms,
      scheduled_at: planned.get(r.id) ?? null,
    };
  });

  const campaign = unwrapOne(
    await db()
      .from('campaigns')
      .insert({ name: `Import – ${imp.filename} – ${format(new Date(), 'MMM d, yyyy')}`, created_by: userId, topic_type: 'IMPORT' })
      .select('id')
      .single(),
    'Create campaign',
  );
  let result;
  try {
    result = await createPosts({ posts: drafts, mode, repeatWeeks: 1, actorId: userId, campaignId: campaign.id, importId, imageSourceOverride: 'sheet' });
  } catch (err) {
    await db().from('campaigns').delete().eq('id', campaign.id);
    throw err;
  }
  for (const [i, r] of ok.entries()) {
    unwrap(await db().from('import_rows').update({ post_id: result.ids[i] ?? null }).eq('id', r.id), 'Link post');
  }
  unwrap(await db().from('imports').update({ status: 'committed', campaign_id: campaign.id }).eq('id', importId), 'Commit import');
  await notify({
    type: 'import_committed',
    title: `Imported ${result.ids.length} post${result.ids.length === 1 ? '' : 's'} from ${imp.filename}`,
    body: result.status === 'pending_approval' ? 'Waiting for approval.' : 'Scheduled to publish.',
    link: result.status === 'pending_approval' ? '/approvals' : `/queue?importId=${importId}`,
  });
  await logActivity({
    actor: userId,
    action: 'import.committed',
    entityType: 'import',
    entityId: importId,
    details: { filename: imp.filename, created: result.ids.length, skipped: rows.length - ok.length, status: result.status },
  });
  return { created: result.ids.length, campaignId: campaign.id, status: result.status };
}

export async function discardImport(importId: string, userId: string): Promise<void> {
  const imp = await loadImport(importId);
  assertEditable(imp);
  const rows = await loadRows(importId);
  const paths = rows
    .map((r) => (r.resolved as unknown as ImportRowResolved | null)?.image?.path)
    .filter((p): p is string => !!p);
  unwrap(await db().from('imports').update({ status: 'discarded' }).eq('id', importId), 'Discard import');
  await removeObjects([...new Set(paths)]);
  await logActivity({ actor: userId, action: 'import.discarded', entityType: 'import', entityId: importId, details: { filename: imp.filename } });
}
