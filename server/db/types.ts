/**
 * Database types for supabase-js, hand-maintained to match supabase/migrations/001_init.sql.
 * Rows must be `type` aliases (not interfaces) to satisfy supabase-js' generic constraints.
 */
import type {
  BrandedTemplate,
  ConnectionStatus,
  CtaType,
  ImageSource,
  ImportRowStatus,
  ImportStatus,
  LibraryExhaustedMode,
  NotificationType,
  PostStatus,
  StockState,
  TopicType,
} from '../../shared/types.js';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Columns with database defaults become optional on insert. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>;

type Rel<FK extends string, Cols extends string, Ref extends string> = {
  foreignKeyName: FK;
  columns: [Cols];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

export type GoogleConnectionRow = {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  refresh_token_enc: string | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  scopes: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
  last_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GbpAccountRow = {
  id: string;
  connection_id: string;
  account_name: string;
  display_name: string | null;
  type: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  brand_voice: string | null;
  default_cta_url: string | null;
  notes: string | null;
  logo_url: string | null;
  logo_path: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_text_color: string | null;
  tagline: string | null;
  preferred_templates: BrandedTemplate[];
  on_library_exhausted: LibraryExhaustedMode;
  low_stock_threshold: number | null;
  stock_state: StockState;
  template_cursor: number;
  created_at: string;
  updated_at: string;
};

export type LocationRow = {
  id: string;
  location_name: string;
  client_id: string | null;
  title: string;
  address_text: string | null;
  city: string | null;
  service_area_text: string | null;
  primary_category: string | null;
  website_uri: string | null;
  maps_uri: string | null;
  place_id: string | null;
  timezone: string;
  /** default = workspace default, auto = inferred from the address on sync, manual = set by the team */
  timezone_source: 'default' | 'auto' | 'manual';
  /** Verified and in good standing on Google (can take posts); null = unknown. */
  google_verified: boolean | null;
  is_active: boolean;
  last_post_at: string | null;
  synced_at: string | null;
  default_connection_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationAccessRow = {
  id: string;
  location_id: string;
  connection_id: string;
  account_name: string;
  role: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type ImageLibraryRow = {
  id: string;
  client_id: string;
  location_id: string | null;
  storage_path: string;
  public_url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  content_hash: string | null;
  original_filename: string | null;
  used_count: number;
  last_used_at: string | null;
  is_active: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRow = {
  id: string;
  name: string;
  topic_type: string | null;
  base_prompt: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportRow = {
  id: string;
  filename: string;
  uploaded_by: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  status: ImportStatus;
  options: Json;
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
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
  language_code: string;
  summary: string;
  cta_type: CtaType | null;
  cta_url: string | null;
  media_url: string | null;
  media_path: string | null;
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
  locked_at: string | null;
  review_note: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportRowRow = {
  id: string;
  import_id: string;
  row_number: number;
  raw: Json;
  resolved: Json;
  candidates: Json;
  matched_location_id: string | null;
  matched_connection_id: string | null;
  match_confidence: number | null;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  post_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  type: NotificationType;
  client_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string | null;
  is_read: boolean;
  emailed_at: string | null;
  created_at: string;
};

export type ActivityLogRow = {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Json;
  created_at: string;
};

export type AppSettingRow = {
  key: string;
  value: Json;
  updated_at: string;
};

export type LibraryStockRow = {
  client_id: string;
  total_images: number;
  unused_images: number;
  upcoming_auto_posts: number;
};

type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: InsertOf<Row, Required>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      google_connections: Table<GoogleConnectionRow, 'google_sub' | 'email'>;
      gbp_accounts: Table<
        GbpAccountRow,
        'connection_id' | 'account_name',
        [Rel<'gbp_accounts_connection_id_fkey', 'connection_id', 'google_connections'>]
      >;
      clients: Table<ClientRow, 'name'>;
      locations: Table<
        LocationRow,
        'location_name' | 'title',
        [
          Rel<'locations_client_id_fkey', 'client_id', 'clients'>,
          Rel<'locations_default_connection_id_fkey', 'default_connection_id', 'google_connections'>,
        ]
      >;
      location_access: Table<
        LocationAccessRow,
        'location_id' | 'connection_id' | 'account_name',
        [
          Rel<'location_access_location_id_fkey', 'location_id', 'locations'>,
          Rel<'location_access_connection_id_fkey', 'connection_id', 'google_connections'>,
        ]
      >;
      image_library: Table<
        ImageLibraryRow,
        'client_id' | 'storage_path' | 'public_url',
        [
          Rel<'image_library_client_id_fkey', 'client_id', 'clients'>,
          Rel<'image_library_location_id_fkey', 'location_id', 'locations'>,
        ]
      >;
      campaigns: Table<CampaignRow, 'name'>;
      imports: Table<
        ImportRow,
        'filename',
        [Rel<'imports_campaign_id_fkey', 'campaign_id', 'campaigns'>]
      >;
      posts: Table<
        PostRow,
        'location_id',
        [
          Rel<'posts_campaign_id_fkey', 'campaign_id', 'campaigns'>,
          Rel<'posts_import_id_fkey', 'import_id', 'imports'>,
          Rel<'posts_location_id_fkey', 'location_id', 'locations'>,
          Rel<'posts_connection_id_fkey', 'connection_id', 'google_connections'>,
          Rel<'posts_image_library_id_fkey', 'image_library_id', 'image_library'>,
        ]
      >;
      import_rows: Table<
        ImportRowRow,
        'import_id' | 'row_number',
        [
          Rel<'import_rows_import_id_fkey', 'import_id', 'imports'>,
          Rel<'import_rows_matched_location_id_fkey', 'matched_location_id', 'locations'>,
          Rel<'import_rows_matched_connection_id_fkey', 'matched_connection_id', 'google_connections'>,
          Rel<'import_rows_post_id_fkey', 'post_id', 'posts'>,
        ]
      >;
      notifications: Table<
        NotificationRow,
        'type' | 'title',
        [Rel<'notifications_client_id_fkey', 'client_id', 'clients'>]
      >;
      activity_log: Table<ActivityLogRow, 'action'>;
      app_settings: Table<AppSettingRow, 'key' | 'value'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_due_posts: {
        Args: { p_limit: number; p_max_attempts?: number };
        Returns: PostRow[];
      };
      pick_library_image: {
        Args: { p_client_id: string; p_location_id: string | null; p_allow_recycle?: boolean };
        Returns: ImageLibraryRow[];
      };
      library_stock: {
        Args: { p_client_id?: string | null };
        Returns: LibraryStockRow[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables = Database['public']['Tables'];
export type TableName = keyof Tables;
export type RowOf<T extends TableName> = Tables[T]['Row'];
export type InsertOfTable<T extends TableName> = Tables[T]['Insert'];
export type UpdateOfTable<T extends TableName> = Tables[T]['Update'];
