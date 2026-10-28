import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { BRANDED_TEMPLATES, type BrandedTemplate, type TopicType } from '../../shared/types.js';
import { generateHeadline } from '../ai/gemini.js';
import { unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import type { ClientRow } from '../db/types.js';
import { putObject } from '../lib/storage.js';
import { badgeTemplate } from './templates/badge.js';
import { gradientTemplate } from './templates/gradient.js';
import { HEIGHT, WIDTH, type SatoriNode, type TemplateInput } from './templates/h.js';
import { minimalTemplate } from './templates/minimal.js';
import { splitTemplate } from './templates/split.js';

const TEMPLATES: Record<BrandedTemplate, (t: TemplateInput) => SatoriNode> = {
  gradient: gradientTemplate,
  split: splitTemplate,
  minimal: minimalTemplate,
  badge: badgeTemplate,
};

// ---------------------------------------------------------------------------------------------
// Fonts (bundled WOFF files; see vercel.json includeFiles)
// ---------------------------------------------------------------------------------------------
type FontDef = { name: string; data: Buffer; weight: 400 | 700 | 800; style: 'normal' };
let fontsPromise: Promise<FontDef[]> | null = null;

async function readFont(file: string): Promise<Buffer> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), 'server/assets/fonts', file),
    path.join(here, '../assets/fonts', file),
    path.join(here, '../../server/assets/fonts', file),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // try next location
    }
  }
  throw new Error(`Font file ${file} not found. Make sure server/assets/fonts is deployed (vercel.json includeFiles).`);
}

function loadFonts(): Promise<FontDef[]> {
  fontsPromise ??= Promise.all(
    ([400, 700, 800] as const).map(async (weight) => ({
      name: 'Plus Jakarta Sans',
      data: await readFont(`PlusJakartaSans-${weight}.woff`),
      weight,
      style: 'normal' as const,
    })),
  ).catch((err) => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise;
}

// ---------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------
const HEX = /^#([0-9a-f]{6})$/i;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  text: string;
}

/** Brand kit colours with neutral fallbacks derived from the client colour. */
export function resolveColors(client: Pick<ClientRow, 'color' | 'brand_primary' | 'brand_secondary' | 'brand_text_color'>): BrandColors {
  const base = HEX.test(client.color) ? client.color : '#8B2CF5';
  const primary = client.brand_primary && HEX.test(client.brand_primary) ? client.brand_primary : base;
  const secondary =
    client.brand_secondary && HEX.test(client.brand_secondary)
      ? client.brand_secondary
      : shade(primary, luminance(primary) > 0.4 ? -0.35 : 0.3);
  const text =
    client.brand_text_color && HEX.test(client.brand_text_color)
      ? client.brand_text_color
      : luminance(primary) > 0.45
        ? '#0B0B14'
        : '#FFFFFF';
  return { primary, secondary, text };
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------
const logoCache = new Map<string, string | null>();

/** Fetches the logo and inlines it as a data URI (satori cannot fetch remote images reliably). */
export async function logoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const type = res.headers.get('content-type') ?? 'image/png';
    const uri = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    logoCache.set(url, uri);
    return uri;
  } catch (err) {
    console.error('[branded] logo fetch failed', url, err instanceof Error ? err.message : err);
    logoCache.set(url, null);
    return null;
  }
}

export async function renderBranded(template: BrandedTemplate, input: TemplateInput): Promise<Buffer> {
  const svg = await satori(TEMPLATES[template](input) as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { loadSystemFonts: false } }).render().asPng();
}

export function topicLabel(topic: TopicType): string | null {
  return topic === 'OFFER' ? 'Offer' : topic === 'EVENT' ? 'Event' : null;
}

/** Picks the next template for a client, rotating through its preferred list. */
export function chooseTemplate(
  client: Pick<ClientRow, 'preferred_templates' | 'template_cursor'>,
  topic: TopicType,
): BrandedTemplate {
  const preferred = (client.preferred_templates ?? []).filter((t): t is BrandedTemplate =>
    (BRANDED_TEMPLATES as readonly string[]).includes(t),
  );
  let pool: BrandedTemplate[] = preferred.length ? preferred : [...BRANDED_TEMPLATES];
  if (topic === 'STANDARD' && pool.length > 1) pool = pool.filter((t) => t !== 'badge');
  if (topic !== 'STANDARD' && pool.includes('badge') && client.template_cursor % 2 === 0) return 'badge';
  return pool[client.template_cursor % pool.length]!;
}

export interface BrandedResult {
  url: string;
  path: string;
  template: BrandedTemplate;
  headline: string;
}

/**
 * Generates a branded graphic for a post, stores it under generated/<client_id>/ and advances
 * the client's rotation cursor so consecutive posts look different.
 */
export async function generateBrandedImage(opts: {
  client: ClientRow;
  businessName: string;
  city: string | null;
  summary: string;
  topicType: TopicType;
  template?: BrandedTemplate;
}): Promise<BrandedResult> {
  const { client } = opts;
  const template = opts.template ?? chooseTemplate(client, opts.topicType);
  const headline = await generateHeadline(opts.summary, opts.businessName);
  const colors = resolveColors(client);
  const png = await renderBranded(template, {
    headline,
    businessName: opts.businessName,
    city: opts.city,
    tagline: client.tagline,
    logo: await logoDataUri(client.logo_url),
    ...colors,
    variant: client.template_cursor,
    topicLabel: topicLabel(opts.topicType),
  });
  const storagePath = `generated/${client.id}/${randomUUID()}.png`;
  const url = await putObject(storagePath, png, 'image/png');
  unwrap(
    await db().from('clients').update({ template_cursor: client.template_cursor + 1 }).eq('id', client.id),
    'Advance template cursor',
  );
  client.template_cursor += 1;
  return { url, path: storagePath, template, headline };
}
