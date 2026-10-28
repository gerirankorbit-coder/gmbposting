import { randomUUID } from 'node:crypto';
import { downloadObject, putObject, removeObjects } from '../lib/storage.js';
import { processImage, type ProcessedImage } from './process.js';

export function safeFilename(name: string): string {
  const base = name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (base || 'image').slice(-80);
}

export function incomingPath(userId: string, filename: string): string {
  return `incoming/${userId.replace(/[^\w-]/g, '')}/${randomUUID()}-${safeFilename(filename)}`;
}

/** Downloads a raw browser upload from `incoming/`, processes it, and always deletes the raw file. */
export async function processIncoming(path: string): Promise<ProcessedImage> {
  try {
    return await processImage(await downloadObject(path));
  } finally {
    await removeObjects([path]);
  }
}

/** Stores a processed JPEG under `<folder>/<yyyy-mm>/<uuid>.jpg` and returns its path and URL. */
export async function storeProcessed(folder: string, image: ProcessedImage): Promise<{ path: string; url: string }> {
  const month = new Date().toISOString().slice(0, 7);
  const path = `${folder}/${month}/${randomUUID()}.jpg`;
  const url = await putObject(path, image.buffer, 'image/jpeg');
  return { path, url };
}
