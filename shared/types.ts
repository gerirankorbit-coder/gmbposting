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

// ---------------------------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------------------------
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConnectionDTO {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  account_count: number;
  location_count: number;
}

export interface SyncResultDTO {
  connectionId: string;
  email: string;
  accounts: number;
  locations: number;
  newLocations: number;
  newClients: number;
  removedAccess: number;
  complete: boolean;
  errors: string[];
}

export interface ClientDTO {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  brand_voice: string | null;
  default_cta_url: string | null;
  notes: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_text_color: string | null;
  tagline: string | null;
  preferred_templates: BrandedTemplate[];
  on_library_exhausted: LibraryExhaustedMode;
  low_stock_threshold: number | null;
  stock_state: StockState;
  location_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClientRef {
  id: string;
  name: string;
  color: string;
}

export interface LocationAccessDTO {
  connection_id: string;
  account_name: string;
  role: string | null;
  email: string;
  status: ConnectionStatus;
}

export interface LocationDTO {
  id: string;
  location_name: string;
  title: string;
  address_text: string | null;
  city: string | null;
  service_area_text: string | null;
  primary_category: string | null;
  website_uri: string | null;
  maps_uri: string | null;
  place_id: string | null;
  timezone: string;
  is_active: boolean;
  last_post_at: string | null;
  synced_at: string | null;
  default_connection_id: string | null;
  client: ClientRef | null;
  access: LocationAccessDTO[];
}

export interface PostDTO {
  id: string;
  campaign_id: string | null;
  import_id: string | null;
  location_id: string;
  connection_id: string | null;
  account_name: string | null;
  image_source: ImageSource;
  image_library_id: string | null;
  branded_template: string | null;
  topic_type: TopicType;
  summary: string;
  cta_type: CtaType | null;
  cta_url: string | null;
  media_url: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  offer_coupon_code: string | null;
  offer_redeem_url: string | null;
  offer_terms: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  google_post_name: string | null;
  google_search_url: string | null;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  review_note: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryImportResult {
  found: number;
  imported: number;
  skipped: number;
}

export interface SignedUploadDTO {
  signedUrl: string;
  path: string;
}

export interface UploadedImageDTO {
  url: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
}

export interface VariationDTO {
  location_id: string;
  summary: string;
}

export interface CreatePostsResult {
  campaign_id: string | null;
  created: number;
  status: PostStatus;
  post_ids: string[];
  /** Only for mode `publish_now`: what happened to these posts in the immediate publisher run. */
  publish?: { published: number; failed: number; queued: number };
}

export interface PostListItemDTO extends PostDTO {
  location: { id: string; title: string; city: string | null; timezone: string; client: ClientRef | null } | null;
  connection_email: string | null;
  campaign: { id: string; name: string } | null;
}

export interface BulkActionResult {
  updated: number;
  skipped: number;
}

export interface LibraryImageDTO {
  id: string;
  client_id: string;
  location_id: string | null;
  public_url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  original_filename: string | null;
  used_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClientStockDTO {
  client: ClientDTO;
  total: number;
  unused: number;
  threshold: number;
  state: StockState;
  upcoming_auto_posts: number;
  /** When the library is projected to run out, based on scheduled auto-image posts. */
  runs_out_at: string | null;
}

export interface LibraryUploadResult {
  added: number;
  duplicates: number;
  errors: string[];
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  client_id: string | null;
  client_name: string | null;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFeedDTO extends Paginated<NotificationDTO> {
  unread: number;
}

export interface SystemAlertsDTO {
  needsReauth: { id: string; email: string }[];
  emptyLibraries: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------------------------
export type ImportImageKind = 'auto' | 'url' | 'file' | 'none';
export type ImportImageStatus = 'ready' | 'pending' | 'failed';

export interface ImportRowResolved {
  content: string;
  topic_type: TopicType;
  cta_type: CtaType | null;
  cta_url: string | null;
  /** Explicit schedule from the sheet (UTC ISO), or null to use the import option. */
  scheduled_at: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  coupon_code: string | null;
  offer_terms: string | null;
  redeem_url: string | null;
  image: {
    kind: ImportImageKind;
    ref: string | null;
    status: ImportImageStatus;
    url: string | null;
    path: string | null;
    error?: string | null;
  };
  timezone: string | null;
  location_title: string | null;
  location_city: string | null;
  client_name: string | null;
  gmail: string | null;
}

export interface ImportCandidate {
  location_id: string;
  title: string;
  city: string | null;
  score: number;
}

export interface ImportOptions {
  schedule: 'asap' | 'spread';
  spreadStart: string | null;
  spreadEnd: string | null;
  startHour: number;
  endHour: number;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { schedule: 'asap', spreadStart: null, spreadEnd: null, startHour: 9, endHour: 18 };

export interface ImportRowDTO {
  id: string;
  row_number: number;
  raw: Record<string, string>;
  resolved: ImportRowResolved | null;
  candidates: ImportCandidate[];
  matched_location_id: string | null;
  matched_connection_id: string | null;
  match_confidence: number | null;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  post_id: string | null;
  /** Final publish time shown in the preview (explicit or from the import option). */
  planned_at: string | null;
}

export interface ImportSummaryDTO {
  id: string;
  filename: string;
  uploaded_by: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  review_rows: number;
  status: ImportStatus;
  options: ImportOptions;
  campaign_id: string | null;
  created_at: string;
  pending_images: number;
}

export interface ImportDetailDTO {
  import: ImportSummaryDTO;
  rows: ImportRowDTO[];
}

export interface PublisherSummary {
  processed: number;
  published: number;
  failed: number;
  remaining: number;
  started_at: string;
  duration_ms: number;
}

export interface ActivityDTO {
  id: string;
  actor: string;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface TeamMemberDTO {
  id: string;
  name: string | null;
  email: string | null;
  image_url: string | null;
  /** null = signed up without an invitation; no access until an admin grants a role. */
  role: Role | null;
  last_sign_in_at: string | null;
}

export interface InvitationDTO {
  id: string;
  email: string;
  role: Role | null;
  created_at: string;
}

export interface DashboardDTO {
  stats: {
    connections: number;
    connections_needing_reauth: number;
    locations: number;
    scheduled_this_week: number;
    published_this_month: number;
    failed: number;
    pending_approval: number;
  };
  upcoming: PostListItemDTO[];
  stale_locations: { id: string; title: string; city: string | null; last_post_at: string | null; client: ClientRef | null }[];
  stale_count: number;
  image_stock: ClientStockDTO[];
  activity: ActivityDTO[];
}
