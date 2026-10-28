import { z } from 'zod';
import { LIBRARY_EXHAUSTED_MODES, ROLES } from './types.js';

export const roleSchema = z.enum(ROLES);

export const uuidSchema = z.string().uuid();

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: 'Unknown time zone.' });

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: 'Use a hex color like #8B2CF5.' });

const optionalUrl = z
  .union([z.string().trim().url({ message: 'Enter a full URL starting with https://' }), z.literal('')])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const intFromQuery = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).catch(fallback).default(fallback);

// ---------------------------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------------------------
export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  color: hexColorSchema.default('#8B2CF5'),
  is_active: z.boolean().default(true),
  brand_voice: optionalText(2000),
  default_cta_url: optionalUrl,
  notes: optionalText(4000),
  on_library_exhausted: z.enum(LIBRARY_EXHAUSTED_MODES).default('branded'),
  low_stock_threshold: z.number().int().min(0).max(1000).nullable().optional().default(null),
});
export type ClientInput = z.input<typeof clientInputSchema>;

export const clientUpdateSchema = clientInputSchema.partial();
export type ClientUpdate = z.input<typeof clientUpdateSchema>;

export const clientMergeSchema = z.object({
  sourceIds: z.array(uuidSchema).min(1).max(100),
});

// ---------------------------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------------------------
export const locationListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  clientId: z.union([uuidSchema, z.literal('none')]).optional(),
  connectionId: uuidSchema.optional(),
  status: z.enum(['active', 'inactive', 'all']).catch('all').default('all'),
  staleDays: z.coerce.number().int().min(1).max(365).optional(),
  sort: z.enum(['title', 'last_post_at', 'city', 'synced_at']).catch('title').default('title'),
  dir: z.enum(['asc', 'desc']).catch('asc').default('asc'),
  page: intFromQuery(1, 100000, 1),
  pageSize: intFromQuery(1, 200, 25),
});
export type LocationListQuery = z.input<typeof locationListQuerySchema>;

export const locationUpdateSchema = z.object({
  client_id: uuidSchema.nullable().optional(),
  timezone: timeZoneSchema.optional(),
  is_active: z.boolean().optional(),
  default_connection_id: uuidSchema.nullable().optional(),
});
export type LocationUpdate = z.input<typeof locationUpdateSchema>;

export const locationBulkSchema = z
  .object({
    ids: z.array(uuidSchema).min(1).max(1000),
    client_id: uuidSchema.nullable().optional(),
    is_active: z.boolean().optional(),
    timezone: timeZoneSchema.optional(),
  })
  .refine((v) => v.client_id !== undefined || v.is_active !== undefined || v.timezone !== undefined, {
    message: 'Nothing to update.',
  });
export type LocationBulkUpdate = z.input<typeof locationBulkSchema>;

export const paginationQuerySchema = z.object({
  page: intFromQuery(1, 100000, 1),
  pageSize: intFromQuery(1, 200, 25),
});
