import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { processImage, MAX_UPLOAD_BYTES } from '../images/process.js';
import { storeProcessed } from '../images/incoming.js';

/** Converts Google Drive and Dropbox share links into direct-download links. */
export function toDirectImageUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const id = url.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get('id');
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (host.endsWith('dropbox.com')) {
    url.searchParams.delete('dl');
    url.searchParams.set('raw', '1');
    return url.toString();
  }
  return url.toString();
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Rejects non-http(s) URLs and hosts that resolve to private or local addresses (SSRF guard). */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http(s) image links are supported.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('This link points to a private address.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('This link points to a private address.');
  return url;
}

/** Downloads a public image (max 15 MB, 15 s, 4 redirects, each hop re-checked). */
export async function downloadPublicImage(rawUrl: string): Promise<Buffer> {
  let current = toDirectImageUrl(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'OrbitPost/1.0 (+image import)' } });
    } catch (err) {
      clearTimeout(timer);
      throw new Error((err as Error).name === 'AbortError' ? 'The image took too long to download.' : 'The image could not be downloaded.');
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const location = res.headers.get('location');
      if (!location) throw new Error('The image link redirected without a destination.');
      current = new URL(location, url).toString();
      continue;
    }
    try {
      if (!res.ok) throw new Error(`The image link returned HTTP ${res.status}.`);
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) throw new Error('The link opens a web page, not an image. Make sure the file is shared publicly ("Anyone with the link").');
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > MAX_UPLOAD_BYTES) throw new Error('The image is larger than 15 MB.');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('The image could not be downloaded.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_UPLOAD_BYTES) {
          await reader.cancel();
          throw new Error('The image is larger than 15 MB.');
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('The image link redirected too many times.');
}

/** Downloads, validates, converts and stores an image from a sheet URL. */
export async function importImageFromUrl(rawUrl: string): Promise<{ url: string; path: string }> {
  const buffer = await downloadPublicImage(rawUrl);
  const image = await processImage(buffer);
  return storeProcessed('uploads', image);
}
