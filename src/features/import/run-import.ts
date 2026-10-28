import type { ImportDetailDTO } from '../../../shared/types';
import { api } from '@/lib/api';
import { uploadIncoming } from '@/lib/upload';
import { expandFiles } from '@/features/library/library-upload';
import { parseSheet } from './sheet';

export interface ImportProgress {
  stage: 'parsing' | 'validating' | 'uploading' | 'processing' | 'done';
  done?: number;
  total?: number;
}

/**
 * Full upload flow: parse the sheet in the browser, validate it on the server, then upload any
 * attached images (raw files go straight to Storage; the API processes them 5 at a time).
 */
export async function runImport(sheet: File, attachments: File[], onProgress: (p: ImportProgress) => void): Promise<{ id: string; fileErrors: string[]; unusedFiles: string[] }> {
  onProgress({ stage: 'parsing' });
  const { rows } = await parseSheet(sheet);
  if (!rows.length) throw new Error('The sheet is empty. Fill in the Posts sheet from the template.');
  onProgress({ stage: 'validating' });
  const created = await api.post<ImportDetailDTO>('/imports', { filename: sheet.name, rows });
  const id = created.import.id;

  const fileErrors: string[] = [];
  const unusedFiles: string[] = [];
  const { files } = await expandFiles(attachments);
  if (files.length) {
    const uploaded: { filename: string; path: string }[] = [];
    let done = 0;
    let next = 0;
    onProgress({ stage: 'uploading', done, total: files.length });
    const worker = async () => {
      while (next < files.length) {
        const f = files[next++]!;
        try {
          uploaded.push({ filename: f.name, path: await uploadIncoming(f) });
        } catch (err) {
          fileErrors.push(err instanceof Error ? err.message : `${f.name}: upload failed`);
        }
        onProgress({ stage: 'uploading', done: ++done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
    for (let i = 0; i < uploaded.length; i += 5) {
      onProgress({ stage: 'processing', done: i, total: uploaded.length });
      const r = await api.post<{ attached: number; unused: string[]; errors: string[] }>(`/imports/${id}/files`, { files: uploaded.slice(i, i + 5) });
      fileErrors.push(...r.errors);
      unusedFiles.push(...r.unused);
    }
  }
  await api.post(`/imports/${id}/files/done`);
  onProgress({ stage: 'done' });
  return { id, fileErrors, unusedFiles };
}
