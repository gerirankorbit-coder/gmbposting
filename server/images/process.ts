import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { badRequest } from '../lib/errors.js';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const TARGET_BYTES = 1.5 * 1024 * 1024;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
  /** sha256 of the processed JPEG, used to skip duplicates. */
  hash: string;
}

function isHeic(buf: Buffer): boolean {
  // ISO-BMFF "ftyp" box with a HEIC/HEIF brand.
  if (buf.length < 12 || buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12);
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}

/**
 * Sharp's prebuilt libheif only decodes AVIF, so HEIC photos (iPhone default) are converted to
 * JPEG with the pure-JS decoder first.
 */
async function decodeHeic(buf: Buffer): Promise<Buffer> {
  const { default: convert } = await import('heic-convert');
  const out = await convert({ buffer: new Uint8Array(buf), format: 'JPEG', quality: 0.95 });
  return Buffer.from(out);
}

/**
 * Validates and normalises an uploaded image: auto-rotate, strip metadata, convert to JPEG,
 * resize to a 1600px long edge, reject tiny images and compress under 1.5 MB.
 */
export async function processImage(input: Buffer, options: { minSize?: boolean } = {}): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) throw badRequest('Images must be 15 MB or smaller.');
  let source = input;
  if (isHeic(input)) {
    try {
      await sharp(input).metadata();
    } catch {
      source = await decodeHeic(input).catch(() => {
        throw badRequest('This HEIC image could not be read. Export it as JPG and try again.');
      });
    }
  }

  let meta: Metadata;
  try {
    meta = await sharp(source, { failOn: 'error' }).metadata();
  } catch {
    throw badRequest('This file is not a supported image. Use JPG, PNG, WEBP or HEIC.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'heif', 'gif', 'tiff', 'avif'].includes(meta.format)) {
    throw badRequest('Unsupported image format. Use JPG, PNG, WEBP or HEIC.');
  }
  // Orientation 5–8 means width/height are swapped once rotated.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  if ((options.minSize ?? true) && (width < MIN_WIDTH || height < MIN_HEIGHT)) {
    throw badRequest(`Image is too small (${width}×${height}). Google needs at least ${MIN_WIDTH}×${MIN_HEIGHT}px.`);
  }

  const base = sharp(source, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb');

  let quality = 86;
  let out = await base.clone().jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  while (out.data.length > TARGET_BYTES && quality > 50) {
    quality -= 8;
    out = await base.clone().jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  }
  if (out.data.length > TARGET_BYTES) {
    out = await base.clone().resize({ width: 1200, height: 1200, fit: 'inside' }).jpeg({ quality: 70, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  }

  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height,
    bytes: out.data.length,
    hash: createHash('sha256').update(out.data).digest('hex'),
  };
}
