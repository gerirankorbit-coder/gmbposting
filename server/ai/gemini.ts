import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { findContentIssues, truncateText } from '../../shared/content.js';
import { POST_SUMMARY_MAX, type CtaType, type TopicType } from '../../shared/types.js';
import { optionalEnv, requireEnv } from '../lib/env.js';
import { ApiError } from '../lib/errors.js';

/** `gemini-flash-latest` is Google's alias that always points at the current Flash model. */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
const BATCH_SIZE = 8;
const CONCURRENCY = 3;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
  return client;
}

export function geminiModel(): string {
  return optionalEnv('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
}

export interface VariationContext {
  location_id: string;
  business: string;
  category: string | null;
  city: string | null;
  serviceArea: string | null;
  brandVoice: string | null;
}

export interface VariationRequest {
  brief: string;
  topicType: TopicType;
  tone: string;
  ctaType: CtaType | null;
  locations: VariationContext[];
  /** Existing texts the new ones must differ from (used when regenerating one card). */
  avoid?: string[];
}

export interface Variation {
  location_id: string;
  summary: string;
}

const SYSTEM_INSTRUCTION = `You write Google Business Profile posts for local businesses on behalf of a local SEO agency.

Rules (follow all of them):
- Write ONE post per business listed. Each post is 150–300 words and never more than 1500 characters.
- Make each post natural, helpful and specific to that business, its category and its city or service area.
- Every post must be meaningfully different from the others: a different opening line, a different structure and a different angle (for example a customer problem, a seasonal tip, a local detail, a behind-the-scenes look, a quick checklist). Never produce word-swapped copies.
- Do NOT include phone numbers, URLs, website addresses or email addresses. A call-to-action button carries the link.
- No ALL-CAPS words or sentences. Use at most 2 emojis per post, or none.
- No misleading claims, guarantees or superlatives you cannot back up. Do not invent prices, discounts, awards, years in business or statistics unless the brief provides them.
- Follow Google Business Profile content policies: no offensive, sexual, dangerous or illegal content and no off-topic content.
- Follow each business's brand voice when one is given.
- End with a short, natural nudge that matches the call-to-action type (without a link).
- Write plain text paragraphs (no markdown, no headings, no hashtags).

Return strict JSON only: an array of objects {"location_id": "<id from the input>", "summary": "<post text>"} with exactly one object per business.`;

const TOPIC_LABEL: Record<TopicType, string> = {
  STANDARD: 'an update post',
  OFFER: 'an offer post (only mention offer details given in the brief)',
  EVENT: 'an event post (only mention event details given in the brief)',
};

const CTA_LABEL: Record<CtaType, string> = {
  BOOK: 'Book',
  ORDER: 'Order online',
  SHOP: 'Shop',
  LEARN_MORE: 'Learn more',
  SIGN_UP: 'Sign up',
  CALL: 'Call now',
};

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      location_id: { type: 'string' },
      summary: { type: 'string' },
    },
    required: ['location_id', 'summary'],
  },
};

const responseSchema = z.array(z.object({ location_id: z.string(), summary: z.string().min(1) }));

function buildPrompt(req: VariationRequest, batch: VariationContext[]): string {
  const lines = [
    `Write ${TOPIC_LABEL[req.topicType]} for each business below.`,
    `Tone: ${req.tone || 'friendly and professional'}.`,
    req.ctaType ? `Call-to-action button: "${CTA_LABEL[req.ctaType]}".` : 'There is no call-to-action button.',
    '',
    'Brief from the agency:',
    req.brief.trim(),
    '',
    'Businesses:',
    ...batch.map((l, i) =>
      [
        `${i + 1}. location_id: ${l.location_id}`,
        `   Business: ${l.business}`,
        l.category ? `   Category: ${l.category}` : null,
        l.city ? `   City: ${l.city}` : null,
        l.serviceArea ? `   Service area: ${l.serviceArea}` : null,
        l.brandVoice ? `   Brand voice: ${l.brandVoice}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ];
  if (req.avoid?.length) {
    lines.push('', 'These posts already exist. Your posts must not resemble them in opening, structure or angle:');
    req.avoid.slice(0, 10).forEach((t, i) => lines.push(`${i + 1}. ${truncateText(t, 400)}`));
  }
  return lines.join('\n');
}

function cleanSummary(text: string): string {
  return truncateText(
    text
      .replace(/\r/g, '')
      .replace(/[*_#`]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    POST_SUMMARY_MAX,
  );
}

async function callModel(prompt: string): Promise<unknown> {
  let response;
  try {
    response = await ai().models.generateContent({
      model: geminiModel(),
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 1,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError(502, 'ai_error', `Gemini request failed: ${message.slice(0, 300)}`);
  }
  const text = response.text ?? '';
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function generateBatch(req: VariationRequest, batch: VariationContext[]): Promise<Variation[]> {
  const ids = new Set(batch.map((b) => b.location_id));
  let prompt = buildPrompt(req, batch);
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = responseSchema.safeParse(await callModel(prompt));
    if (parsed.success) {
      const byId = new Map<string, string>();
      for (const item of parsed.data) if (ids.has(item.location_id)) byId.set(item.location_id, cleanSummary(item.summary));
      const flagged = [...byId.entries()].filter(([, s]) => {
        const i = findContentIssues(s);
        return i.phone || i.email || i.url;
      });
      if (byId.size === ids.size && (flagged.length === 0 || attempt === 1)) {
        return batch.map((b) => ({ location_id: b.location_id, summary: byId.get(b.location_id)! }));
      }
      prompt = `${buildPrompt(req, batch)}\n\nYour previous answer ${
        byId.size !== ids.size ? 'missed some location_id values' : 'included phone numbers, emails or links'
      }. Return one post for every location_id and follow every rule.`;
      continue;
    }
    prompt = `${buildPrompt(req, batch)}\n\nYour previous answer was not valid JSON. Return only the JSON array.`;
  }
  throw new ApiError(502, 'ai_invalid_output', 'Gemini returned an invalid response twice. Please try again.');
}

/** Generates one unique post per location, in batches of up to 8 locations per call. */
export async function generateVariations(req: VariationRequest): Promise<Variation[]> {
  const batches: VariationContext[][] = [];
  for (let i = 0; i < req.locations.length; i += BATCH_SIZE) batches.push(req.locations.slice(i, i + BATCH_SIZE));
  const results: Variation[][] = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const index = next++;
      results[index] = await generateBatch(req, batches[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return results.flat();
}

const HEADLINE_INSTRUCTION = `You write short headlines for social graphics of local businesses.
Return one headline of 3 to 8 words that captures the main point of the post.
No phone numbers, URLs, emails, hashtags, emojis, quotes or ALL CAPS. No prices or discounts unless they appear in the post.
Return only the headline text.`;

/** Fallback headline: the first sentence of the post, trimmed to 8 words. */
export function fallbackHeadline(summary: string, business: string): string {
  const first = summary.replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0] ?? '';
  const words = first.replace(/[^\p{L}\p{N}%&' -]/gu, '').split(' ').filter(Boolean).slice(0, 8);
  return words.length >= 3 ? words.join(' ') : `News from ${business}`;
}

/** 3–8 word headline for a branded graphic. Falls back to a heuristic when AI is unavailable. */
export async function generateHeadline(summary: string, business: string): Promise<string> {
  if (!optionalEnv('GEMINI_API_KEY') || !summary.trim()) return fallbackHeadline(summary, business);
  try {
    const response = await ai().models.generateContent({
      model: geminiModel(),
      contents: `Business: ${business}\nPost:\n${truncateText(summary, 1500)}`,
      config: { systemInstruction: HEADLINE_INSTRUCTION, temperature: 0.7, maxOutputTokens: 40 },
    });
    const text = (response.text ?? '').replace(/["“”#*_]/g, '').replace(/\s+/g, ' ').trim();
    const words = text.split(' ').filter(Boolean);
    const issues = findContentIssues(text);
    if (words.length < 2 || words.length > 10 || issues.phone || issues.url || issues.email) {
      return fallbackHeadline(summary, business);
    }
    return words.slice(0, 8).join(' ').replace(/[.]+$/, '');
  } catch (err) {
    console.error('[gemini] headline failed', err instanceof Error ? err.message : err);
    return fallbackHeadline(summary, business);
  }
}
