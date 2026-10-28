export const ROLES = ['admin', 'manager', 'writer'] as const;
export type Role = (typeof ROLES)[number];

/** Higher rank includes every permission of lower ranks. */
export const ROLE_RANK: Record<Role, number> = { writer: 1, manager: 2, admin: 3 };

export function hasRole(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Me {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  role: Role;
}

export interface HealthStatus {
  ok: boolean;
  time: string;
  version: string;
  config: Record<string, boolean>;
  /** null when Supabase is not configured; false when the database is unreachable. */
  database: boolean | null;
}

// ---------------------------------------------------------------------------------------------
// Domain enums (mirrors CHECK constraints in supabase/migrations/001_init.sql)
// ---------------------------------------------------------------------------------------------
export const CONNECTION_STATUSES = ['active', 'needs_reauth', 'revoked'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const POST_STATUSES = [
  'draft',
  'pending_approval',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const TOPIC_TYPES = ['STANDARD', 'EVENT', 'OFFER'] as const;
export type TopicType = (typeof TOPIC_TYPES)[number];

export const CTA_TYPES = ['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL'] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const IMAGE_SOURCES = ['sheet', 'upload', 'library', 'branded', 'none', 'auto'] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const LIBRARY_EXHAUSTED_MODES = ['branded', 'recycle'] as const;
export type LibraryExhaustedMode = (typeof LIBRARY_EXHAUSTED_MODES)[number];

export const STOCK_STATES = ['ok', 'low', 'empty'] as const;
export type StockState = (typeof STOCK_STATES)[number];

export const IMPORT_STATUSES = ['validating', 'ready', 'committed', 'discarded'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_ROW_STATUSES = ['ok', 'needs_review', 'error'] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'library_low',
  'library_empty',
  'library_refilled',
  'connection_needs_reauth',
  'post_failed',
  'import_ready',
  'import_committed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const BRANDED_TEMPLATES = ['gradient', 'split', 'minimal', 'badge'] as const;
export type BrandedTemplate = (typeof BRANDED_TEMPLATES)[number];

export interface AppSettings {
  approval_required: boolean;
  max_posts_per_run: number;
  publish_spacing_seconds: number;
  default_timezone: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  approval_required: true,
  max_posts_per_run: 20,
  publish_spacing_seconds: 3,
  default_timezone: 'Asia/Karachi',
};

export const POST_SUMMARY_MAX = 1500;
