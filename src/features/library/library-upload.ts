import JSZip from 'jszip';
import type { LibraryUploadResult } from '../../../shared/types';
import { api } from '@/lib/api';
import { uploadIncoming, validateImageFile } from '@/lib/upload';

const IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif)$/i;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

/** Expands ZIP archives into their image files; other files pass through. */
export async function expandFiles(files: File[]): Promise<{ files: File[]; skipped: string[] }> {
  const out: File[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.startsWith('__MACOSX') && !e.name.split('/').pop()!.startsWith('.'));
      for (const entry of entries) {
        const name = entry.name.split('/').pop()!;
        if (!IMAGE_NAME.test(name)) {
          skipped.push(name);
          continue;
        }
        const blob = await entry.async('blob');
        const ext = name.split('.').pop()!.toLowerCase();
        out.push(new File([blob], name, { type: MIME[ext] ?? 'application/octet-stream' }));
      }
    } else if (IMAGE_NAME.test(file.name) || file.type.startsWith('image/')) {
      out.push(file);
    } else {
      skipped.push(file.name);
    }
  }
  return { files: out, skipped };
}

export interface UploadProgress {
  total: number;
  uploaded: number;
  processed: number;
}

/**
 * Uploads raw files to Storage (3 at a time), then asks the API to process them in batches of
 * 5 so each request stays well inside the function time limit.
 */
export async function uploadToLibrary(
  clientId: string,
  files: File[],
  locationId: string | null,
  onProgress: (p: UploadProgress) => void,
): Promise<LibraryUploadResult> {
  const result: LibraryUploadResult = { added: 0, duplicates: 0, errors: [] };
  const progress: UploadProgress = { total: files.length, uploaded: 0, processed: 0 };
  const ready: { path: string; name: string }[] = [];
  const valid = files.filter((f) => {
    const problem = validateImageFile(f);
    if (problem) result.errors.push(problem);
    return !problem;
  });
  progress.total = valid.length;
  onProgress({ ...progress });

  let next = 0;
  const worker = async () => {
    while (next < valid.length) {
      const file = valid[next++]!;
      try {
        ready.push({ path: await uploadIncoming(file), name: file.name });
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : `${file.name}: upload failed`);
      }
      progress.uploaded++;
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, valid.length) }, worker));

  for (let i = 0; i < ready.length; i += 5) {
    const batch = ready.slice(i, i + 5);
    try {
      const r = await api.post<LibraryUploadResult>(`/library/${clientId}/images`, {
        paths: batch.map((b) => b.path),
        filenames: batch.map((b) => b.name),
        location_id: locationId,
      });
      result.added += r.added;
      result.duplicates += r.duplicates;
      result.errors.push(...r.errors);
    } catch (err) {
      result.errors.push(`${batch.map((b) => b.name).join(', ')}: ${err instanceof Error ? err.message : 'processing failed'}`);
    }
    progress.processed += batch.length;
    onProgress({ ...progress });
  }
  return result;
}
