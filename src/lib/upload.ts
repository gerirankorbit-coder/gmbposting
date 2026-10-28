import { UPLOAD_MAX_BYTES } from '../../shared/schemas';
import type { SignedUploadDTO, UploadedImageDTO } from '../../shared/types';
import { api } from './api';

const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_EXT.test(file.name) && !file.type.startsWith('image/')) {
    return `${file.name}: use JPG, PNG, WEBP or HEIC.`;
  }
  if (file.size > UPLOAD_MAX_BYTES) return `${file.name} is larger than 15 MB.`;
  return null;
}

/**
 * Uploads the raw file to a one-time signed Storage URL (bypassing the 4.5 MB function body
 * limit), then asks the API to validate, convert and compress it. Returns the final image.
 */
export async function uploadIncoming(file: File): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const signed = await api.post<SignedUploadDTO>('/uploads/sign', {
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', file);
  const res = await fetch(signed.signedUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false' } });
  if (!res.ok) throw new Error(`Upload of ${file.name} failed (${res.status}).`);
  return signed.path;
}

export async function uploadImage(file: File): Promise<UploadedImageDTO> {
  const path = await uploadIncoming(file);
  return api.post<UploadedImageDTO>('/uploads/complete', { path });
}
