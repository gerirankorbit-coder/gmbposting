import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireEnv } from './env.js';

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

let cachedKey: Buffer | null = null;
function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const key = Buffer.from(requireEnv('TOKEN_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64 (openssl rand -base64 32).');
  }
  cachedKey = key;
  return key;
}

/** AES-256-GCM encrypt. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error('Encrypted value has an unknown format.');
  }
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

function hmac(value: string): string {
  return createHmac('sha256', requireEnv('OAUTH_STATE_SECRET')).update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Signs a JSON payload with an expiry: `<payload>.<signature>`. */
export function signState<T extends object>(payload: T, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, nonce: randomBytes(12).toString('base64url'), exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url');
  return `${body}.${hmac(body)}`;
}

/** Verifies a signed state value; returns null when tampered with or expired. */
export function verifyState<T extends object>(state: string): (T & { nonce: string; exp: number }) | null {
  const [body, sig] = state.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & {
      nonce: string;
      exp: number;
    };
    if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
