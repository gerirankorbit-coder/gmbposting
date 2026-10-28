import { z } from 'zod';
import { BRANDED_TEMPLATES, CTA_TYPES, LIBRARY_EXHAUSTED_MODES, NOTIFICATION_TYPES, POST_STATUSES, POST_SUMMARY_MAX, ROLES, TOPIC_TYPES } from './types.js';

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

// ---------------------------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------------------------
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const UPLOAD_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const uploadSignSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().max(100).optional().default(''),
  size: z.number().int().positive().max(UPLOAD_MAX_BYTES, 'Images must be 15 MB or smaller.'),
});

export const uploadCompleteSchema = z.object({
  path: z.string().regex(/^incoming\/[\w-]+\/[\w.-]+$/, 'Invalid upload path.'),
});

// ---------------------------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------------------------
export const AI_MAX_LOCATIONS_PER_REQUEST = 40;

export const aiVariationsSchema = z.object({
  brief: z.string().trim().min(10, 'Describe the post in at least a few words.').max(4000),
  topicType: z.enum(TOPIC_TYPES).default('STANDARD'),
  tone: z.string().trim().max(200).default('friendly and professional'),
  ctaType: z.enum(CTA_TYPES).nullable().default(null),
  locationIds: z.array(uuidSchema).min(1).max(AI_MAX_LOCATIONS_PER_REQUEST),
  avoid: z.array(z.string().max(1500)).max(10).optional(),
});
export type AiVariationsInput = z.input<typeof aiVariationsSchema>;

// ---------------------------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------------------------
const isoDateTime = z.string().datetime({ offset: true });

/** One post as submitted by the compose wizard (and, later, imports). */
export const postDraftSchema = z
  .object({
    location_id: uuidSchema,
    connection_id: uuidSchema,
    topic_type: z.enum(TOPIC_TYPES).default('STANDARD'),
    summary: z.string().trim().max(POST_SUMMARY_MAX, `Posts are limited to ${POST_SUMMARY_MAX} characters.`),
    cta_type: z.enum(CTA_TYPES).nullable().default(null),
    cta_url: optionalUrl,
    image_source: z.enum(['upload', 'library', 'none', 'auto']).default('auto'),
    media_url: z.string().url().nullable().optional().default(null),
    media_path: z.string().max(500).nullable().optional().default(null),
    image_library_id: uuidSchema.nullable().optional().default(null),
    event_title: optionalText(58),
    event_start: isoDateTime.nullable().optional().default(null),
    event_end: isoDateTime.nullable().optional().default(null),
    offer_coupon_code: optionalText(58),
    offer_redeem_url: optionalUrl,
    offer_terms: optionalText(5000),
    scheduled_at: isoDateTime.nullable().default(null),
  })
  .superRefine((p, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (!p.summary && p.topic_type === 'STANDARD') issue('summary', 'Write the post text.');
    if (p.image_source === 'upload' && !p.media_url) issue('media_url', 'Upload an image or choose another image option.');
    if (p.image_source === 'library' && !p.image_library_id) issue('image_library_id', 'Pick a library image.');
    if (p.topic_type !== 'STANDARD') {
      if (!p.event_title) issue('event_title', 'Add a title.');
      if (!p.event_start || !p.event_end) issue('event_start', 'Add a start and end date.');
      else if (new Date(p.event_end) < new Date(p.event_start)) issue('event_end', 'The end must be after the start.');
    }
  });
export type PostDraftInput = z.input<typeof postDraftSchema>;
export type PostDraft = z.output<typeof postDraftSchema>;

export const POST_SUBMIT_MODES = ['draft', 'submit', 'approve'] as const;
export type PostSubmitMode = (typeof POST_SUBMIT_MODES)[number];

export const createPostsSchema = z.object({
  campaign: z
    .object({
      name: z.string().trim().min(1).max(200),
      base_prompt: optionalText(4000),
    })
    .nullable()
    .default(null),
  mode: z.enum(POST_SUBMIT_MODES).default('submit'),
  /** Creates N weekly copies (week 0 included). */
  repeatWeeks: z.number().int().min(1).max(52).default(1),
  posts: z.array(postDraftSchema).min(1).max(500),
});
export type CreatePostsInput = z.input<typeof createPostsSchema>;

const csvOrArray = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(item).optional(),
  );

export const postListQuerySchema = z.object({
  status: csvOrArray(z.enum(POST_STATUSES)),
  clientId: uuidSchema.optional(),
  locationId: uuidSchema.optional(),
  connectionId: uuidSchema.optional(),
  campaignId: uuidSchema.optional(),
  importId: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['scheduled_at', 'created_at', 'published_at']).catch('scheduled_at').default('scheduled_at'),
  dir: z.enum(['asc', 'desc']).catch('desc').default('desc'),
  page: intFromQuery(1, 100000, 1),
  pageSize: intFromQuery(1, 500, 25),
});
export type PostListQuery = z.input<typeof postListQuerySchema>;

export const calendarQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  clientId: uuidSchema.optional(),
});

/** Editable fields of an existing post; every key is optional. */
export const postUpdateSchema = z.object({
  summary: z.string().trim().max(POST_SUMMARY_MAX).optional(),
  connection_id: uuidSchema.optional(),
  cta_type: z.enum(CTA_TYPES).nullable().optional(),
  cta_url: z.union([z.string().trim().url(), z.literal('')]).nullable().optional(),
  image_source: z.enum(['upload', 'auto', 'none', 'library', 'branded']).optional(),
  media_url: z.string().url().nullable().optional(),
  media_path: z.string().max(500).nullable().optional(),
  event_title: z.string().trim().max(58).nullable().optional(),
  event_start: isoDateTime.nullable().optional(),
  event_end: isoDateTime.nullable().optional(),
  offer_coupon_code: z.string().trim().max(58).nullable().optional(),
  offer_redeem_url: z.union([z.string().trim().url(), z.literal('')]).nullable().optional(),
  offer_terms: z.string().trim().max(5000).nullable().optional(),
  scheduled_at: isoDateTime.nullable().optional(),
});
export type PostUpdate = z.input<typeof postUpdateSchema>;

export const postIdsSchema = z.object({ ids: z.array(uuidSchema).min(1).max(1000) });
export const rejectPostsSchema = postIdsSchema.extend({ note: z.string().trim().min(1, 'Add a note for the writer.').max(1000) });
export const reschedulePostSchema = z.object({ scheduled_at: isoDateTime });

// ---------------------------------------------------------------------------------------------
// Library & brand kit
// ---------------------------------------------------------------------------------------------
export const brandKitSchema = z.object({
  brand_primary: hexColorSchema.nullable().optional(),
  brand_secondary: hexColorSchema.nullable().optional(),
  brand_text_color: hexColorSchema.nullable().optional(),
  tagline: z.string().trim().max(80).nullable().optional(),
  preferred_templates: z.array(z.enum(BRANDED_TEMPLATES)).max(4).optional(),
  on_library_exhausted: z.enum(LIBRARY_EXHAUSTED_MODES).optional(),
  low_stock_threshold: z.number().int().min(0).max(1000).nullable().optional(),
});
export type BrandKitUpdate = z.input<typeof brandKitSchema>;

export const libraryCompleteSchema = z.object({
  paths: z.array(uploadCompleteSchema.shape.path).min(1).max(5),
  location_id: uuidSchema.nullable().optional(),
  filenames: z.array(z.string().max(255)).max(5).optional(),
});

export const libraryImageUpdateSchema = z.object({
  is_active: z.boolean().optional(),
  location_id: uuidSchema.nullable().optional(),
});

export const brandedPreviewSchema = z.object({
  template: z.enum(BRANDED_TEMPLATES),
  headline: z.string().trim().max(90).optional(),
  topic: z.enum(TOPIC_TYPES).default('STANDARD'),
  overrides: brandKitSchema.pick({ brand_primary: true, brand_secondary: true, brand_text_color: true, tagline: true }).optional(),
});

export const brandedRegenerateSchema = z.object({ template: z.enum(BRANDED_TEMPLATES).optional() });

export const notificationListQuerySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  clientId: uuidSchema.optional(),
  unread: z.enum(['1', '0']).optional(),
  page: intFromQuery(1, 100000, 1),
  pageSize: intFromQuery(1, 100, 20),
});

// ---------------------------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------------------------
export const importOptionsSchema = z
  .object({
    schedule: z.enum(['asap', 'spread']),
    spreadStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    spreadEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((o) => o.schedule === 'asap' || (o.spreadStart && o.spreadEnd && o.spreadEnd >= o.spreadStart), {
    message: 'Choose a valid date range.',
  })
  .refine((o) => o.endHour > o.startHour, { message: 'The end hour must be after the start hour.' });

export const createImportSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  rows: z.array(z.record(z.string(), z.string().max(5000))).min(1).max(2000),
});

export const importRowPatchSchema = z.object({
  location_id: uuidSchema.optional(),
  gmail: z.string().trim().max(320).optional(),
  post_content: z.string().max(5000).optional(),
  schedule_date: z.string().max(40).optional(),
  schedule_time: z.string().max(40).optional(),
  image: z.string().max(2000).optional(),
});
export type ImportRowPatch = z.input<typeof importRowPatchSchema>;

export const importFilesSchema = z.object({
  files: z
    .array(z.object({ filename: z.string().min(1).max(255), path: uploadCompleteSchema.shape.path }))
    .min(1)
    .max(5),
});

export const importCommitSchema = z.object({ mode: z.enum(['submit', 'approve']).default('submit') });
