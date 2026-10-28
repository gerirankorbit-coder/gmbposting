import { db } from '../db/supabase.js';
import { env } from './env.js';
import { ApiError } from './errors.js';

/** Uploads bytes to the public media bucket and returns the public URL. */
export async function putObject(path: string, body: Buffer, contentType: string): Promise<string> {
  const bucket = db().storage.from(env.storageBucket);
  const { error } = await bucket.upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) {
    console.error('[storage] upload failed', path, error.message);
    throw new ApiError(502, 'storage_error', `Could not store the file: ${error.message}`);
  }
  return publicUrl(path);
}

export function publicUrl(path: string): string {
  return db().storage.from(env.storageBucket).getPublicUrl(path).data.publicUrl;
}

export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(env.storageBucket).download(path);
  if (error || !data) {
    throw new ApiError(404, 'not_found', 'The uploaded file could not be found. Please upload it again.');
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removeObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await db().storage.from(env.storageBucket).remove(paths);
  if (error) console.error('[storage] remove failed', error.message);
}

/** One-time signed URL the browser uses to PUT a raw upload into `incoming/`. */
export async function createSignedUpload(path: string): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await db().storage.from(env.storageBucket).createSignedUploadUrl(path);
  if (error || !data) {
    throw new ApiError(502, 'storage_error', `Could not prepare the upload: ${error?.message ?? 'unknown error'}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}
