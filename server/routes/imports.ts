import { Hono } from 'hono';
import {
  createImportSchema,
  importCommitSchema,
  importFilesSchema,
  importOptionsSchema,
  importRowPatchSchema,
  paginationQuerySchema,
} from '../../shared/schemas.js';
import { hasRole, type ImportSummaryDTO, type Paginated } from '../../shared/types.js';
import { dbError, pageRange } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { forbidden } from '../lib/errors.js';
import { parseBody, parseQuery } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';
import {
  attachFiles,
  commitImport,
  createImport,
  discardImport,
  finishFiles,
  getImportDetail,
  processUrlImages,
  toSummary,
  updateOptions,
  updateRow,
} from '../import/service.js';

function assertOwnUploads(paths: string[], userId: string) {
  const owner = userId.replace(/[^\w-]/g, '');
  if (paths.some((p) => p.split('/')[1] !== owner)) throw forbidden('These uploads belong to someone else.');
}

export const importRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const q = parseQuery(c, paginationQuerySchema);
    const [from, to] = pageRange(q.page, q.pageSize);
    const { data, error, count } = await db()
      .from('imports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw dbError(error, 'Load imports');
    const body: Paginated<ImportSummaryDTO> = { items: (data ?? []).map((i) => toSummary(i)), total: count ?? 0, page: q.page, pageSize: q.pageSize };
    return c.json(body);
  })

  .post('/', async (c) => {
    const body = await parseBody(c, createImportSchema);
    const id = await createImport(body.filename, body.rows, c.get('user').id);
    return c.json(await getImportDetail(id), 201);
  })

  .get('/:id', async (c) => c.json(await getImportDetail(c.req.param('id'))))

  .patch('/:id/options', async (c) => {
    const options = await parseBody(c, importOptionsSchema);
    await updateOptions(c.req.param('id'), options);
    return c.json(await getImportDetail(c.req.param('id')));
  })

  .patch('/:id/rows/:rowId', async (c) => {
    const patch = await parseBody(c, importRowPatchSchema);
    await updateRow(c.req.param('id'), c.req.param('rowId'), patch);
    return c.json(await getImportDetail(c.req.param('id')));
  })

  .post('/:id/files', async (c) => {
    const { files } = await parseBody(c, importFilesSchema);
    assertOwnUploads(files.map((f) => f.path), c.get('user').id);
    return c.json(await attachFiles(c.req.param('id'), files));
  })

  .post('/:id/files/done', async (c) => c.json({ missing: await finishFiles(c.req.param('id')) }))

  .post('/:id/process-images', async (c) => c.json(await processUrlImages(c.req.param('id'))))

  .post('/:id/commit', async (c) => {
    const { mode } = await parseBody(c, importCommitSchema);
    if (mode === 'approve' && !hasRole(c.get('user').role, 'manager')) throw forbidden('Only managers can approve and schedule.');
    return c.json(await commitImport(c.req.param('id'), mode, c.get('user').id));
  })

  .post('/:id/discard', async (c) => {
    await discardImport(c.req.param('id'), c.get('user').id);
    return c.json({ ok: true });
  });
