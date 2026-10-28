-- OrbitPost by Rank Orbit: initial schema
-- Run once in the Supabase SQL editor (or `supabase db push`). All timestamps are UTC.
-- The browser never talks to Supabase; the API uses the service-role key, so RLS is enabled
-- with no policies (deny-all for anon/authenticated keys).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Google connections (one row per connected Gmail)
-- ---------------------------------------------------------------------------------------------
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  display_name text,
  avatar_url text,
  refresh_token_enc text,
  access_token_enc text,
  access_token_expires_at timestamptz,
  scopes text,
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked')),
  last_synced_at timestamptz,
  last_error text,
  connected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index google_connections_email_idx on public.google_connections (lower(email));
create index google_connections_status_idx on public.google_connections (status);

create table public.gbp_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_connections (id) on delete cascade,
  account_name text not null,
  display_name text,
  type text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, account_name)
);
create index gbp_accounts_connection_idx on public.gbp_accounts (connection_id);

-- ---------------------------------------------------------------------------------------------
-- Clients (brands) and locations
-- ---------------------------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#8B2CF5',
  is_active boolean not null default true,
  brand_voice text,
  default_cta_url text,
  notes text,
  -- brand kit
  logo_url text,
  logo_path text,
  brand_primary text,
  brand_secondary text,
  brand_text_color text,
  tagline text,
  preferred_templates text[] not null default '{}',
  -- library settings
  on_library_exhausted text not null default 'branded' check (on_library_exhausted in ('branded', 'recycle')),
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  -- bookkeeping: last notified stock state and branded-template rotation cursor
  stock_state text not null default 'ok' check (stock_state in ('ok', 'low', 'empty')),
  template_cursor integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_active_idx on public.clients (is_active);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  location_name text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  address_text text,
  city text,
  service_area_text text,
  primary_category text,
  website_uri text,
  maps_uri text,
  place_id text,
  timezone text not null default 'Asia/Karachi',
  is_active boolean not null default true,
  last_post_at timestamptz,
  synced_at timestamptz,
  default_connection_id uuid references public.google_connections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index locations_client_idx on public.locations (client_id);
create index locations_default_connection_idx on public.locations (default_connection_id);
create index locations_active_idx on public.locations (is_active);

create table public.location_access (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  connection_id uuid not null references public.google_connections (id) on delete cascade,
  account_name text not null,
  role text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, connection_id)
);
create index location_access_location_idx on public.location_access (location_id);
create index location_access_connection_idx on public.location_access (connection_id);

-- ---------------------------------------------------------------------------------------------
-- Image library
-- ---------------------------------------------------------------------------------------------
create table public.image_library (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  storage_path text not null,
  public_url text not null,
  width integer,
  height integer,
  bytes integer,
  content_hash text,
  original_filename text,
  used_count integer not null default 0,
  last_used_at timestamptz,
  is_active boolean not null default true,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index image_library_client_idx on public.image_library (client_id);
create index image_library_location_idx on public.image_library (location_id);
create index image_library_pick_idx on public.image_library (client_id, is_active, used_count, created_at);
create unique index image_library_hash_uidx on public.image_library (client_id, content_hash)
  where content_hash is not null;

-- ---------------------------------------------------------------------------------------------
-- Campaigns, imports and posts
-- ---------------------------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  topic_type text,
  base_prompt text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  uploaded_by text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  status text not null default 'validating' check (status in ('validating', 'ready', 'committed', 'discarded')),
  options jsonb not null default '{}'::jsonb,
  campaign_id uuid references public.campaigns (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index imports_campaign_idx on public.imports (campaign_id);
create index imports_created_idx on public.imports (created_at desc);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete set null,
  import_id uuid references public.imports (id) on delete set null,
  location_id uuid not null references public.locations (id) on delete cascade,
  connection_id uuid references public.google_connections (id) on delete set null,
  account_name text,
  image_source text not null default 'auto' check (image_source in ('sheet', 'upload', 'library', 'branded', 'none', 'auto')),
  image_library_id uuid references public.image_library (id) on delete set null,
  branded_template text,
  topic_type text not null default 'STANDARD' check (topic_type in ('STANDARD', 'EVENT', 'OFFER')),
  language_code text not null default 'en-US',
  summary text not null default '' check (char_length(summary) <= 1500),
  cta_type text check (cta_type in ('BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL')),
  cta_url text,
  media_url text,
  media_path text,
  event_title text,
  event_start timestamptz,
  event_end timestamptz,
  offer_coupon_code text,
  offer_redeem_url text,
  offer_terms text,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  google_post_name text,
  google_search_url text,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  locked_at timestamptz,
  review_note text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_status_scheduled_idx on public.posts (status, scheduled_at);
create index posts_retry_idx on public.posts (status, next_attempt_at) where status = 'failed';
create index posts_campaign_idx on public.posts (campaign_id);
create index posts_import_idx on public.posts (import_id);
create index posts_location_idx on public.posts (location_id);
create index posts_connection_idx on public.posts (connection_id);
create index posts_image_library_idx on public.posts (image_library_id);
create unique index posts_google_post_name_uidx on public.posts (google_post_name)
  where google_post_name is not null;

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer not null,
  raw jsonb not null default '{}'::jsonb,
  resolved jsonb not null default '{}'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  matched_location_id uuid references public.locations (id) on delete set null,
  matched_connection_id uuid references public.google_connections (id) on delete set null,
  match_confidence real,
  status text not null default 'error' check (status in ('ok', 'needs_review', 'error')),
  errors text[] not null default '{}',
  warnings text[] not null default '{}',
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, row_number)
);
create index import_rows_import_idx on public.import_rows (import_id);
create index import_rows_location_idx on public.import_rows (matched_location_id);
create index import_rows_connection_idx on public.import_rows (matched_connection_id);
create index import_rows_post_idx on public.import_rows (post_id);

-- ---------------------------------------------------------------------------------------------
-- Notifications, activity log, settings
-- ---------------------------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('library_low', 'library_empty', 'library_refilled', 'connection_needs_reauth', 'post_failed', 'import_ready', 'import_committed')),
  client_id uuid references public.clients (id) on delete cascade,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  is_read boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_client_idx on public.notifications (client_id);
create index notifications_feed_idx on public.notifications (is_read, created_at desc);
create index notifications_email_idx on public.notifications (emailed_at) where emailed_at is null;
-- At most one unread notification per dedupe key.
create unique index notifications_dedupe_uidx on public.notifications (dedupe_key)
  where dedupe_key is not null and is_read = false;

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_action_idx on public.activity_log (action);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('approval_required', 'true'::jsonb),
  ('max_posts_per_run', '20'::jsonb),
  ('publish_spacing_seconds', '3'::jsonb),
  ('default_timezone', '"Asia/Karachi"'::jsonb),
  ('last_digest_email_at', 'null'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'google_connections', 'gbp_accounts', 'clients', 'locations', 'location_access',
    'image_library', 'campaigns', 'imports', 'posts', 'import_rows', 'app_settings'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security: deny-all for anon/authenticated (service role bypasses RLS)
-- ---------------------------------------------------------------------------------------------
alter table public.google_connections enable row level security;
alter table public.gbp_accounts enable row level security;
alter table public.clients enable row level security;
alter table public.locations enable row level security;
alter table public.location_access enable row level security;
alter table public.image_library enable row level security;
alter table public.campaigns enable row level security;
alter table public.imports enable row level security;
alter table public.posts enable row level security;
alter table public.import_rows enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------------------------
-- RPC: claim due posts for the publisher (atomic, concurrency-safe)
-- ---------------------------------------------------------------------------------------------
-- 1. Posts stuck in 'publishing' for more than 10 minutes are released as failed (retryable).
-- 2. Due posts are moved to 'publishing' with FOR UPDATE SKIP LOCKED so two concurrent runs
--    can never claim the same post.
create or replace function public.claim_due_posts(p_limit integer, p_max_attempts integer default 3)
returns setof public.posts
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set status = 'failed',
         attempts = attempts + 1,
         last_error = 'Publishing was interrupted (stale lock released).',
         next_attempt_at = case when attempts + 1 < p_max_attempts then now() else null end,
         locked_at = null
   where status = 'publishing'
     and locked_at < now() - interval '10 minutes';

  return query
  update public.posts p
     set status = 'publishing',
         locked_at = now()
   where p.id in (
     select c.id
       from public.posts c
      where (c.status = 'scheduled' and c.scheduled_at <= now())
         or (c.status = 'failed'
             and c.attempts < p_max_attempts
             and c.next_attempt_at is not null
             and c.next_attempt_at <= now())
      order by coalesce(c.scheduled_at, c.created_at)
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning p.*;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPC: pick the next library image for a client/location (atomic)
-- ---------------------------------------------------------------------------------------------
-- Unused images first (location-specific before client-wide, oldest upload first). When none
-- are unused and p_allow_recycle is true, the least recently used image is reused.
-- Returns no row when nothing can be picked.
create or replace function public.pick_library_image(
  p_client_id uuid,
  p_location_id uuid,
  p_allow_recycle boolean default false
)
returns setof public.image_library
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select i.id into v_id
    from public.image_library i
   where i.client_id = p_client_id
     and i.is_active
     and i.used_count = 0
     and (i.location_id is null or i.location_id = p_location_id)
   order by (i.location_id is null), i.created_at, i.id
   limit 1
   for update skip locked;

  if v_id is null and p_allow_recycle then
    select i.id into v_id
      from public.image_library i
     where i.client_id = p_client_id
       and i.is_active
       and (i.location_id is null or i.location_id = p_location_id)
     order by i.last_used_at nulls first, i.used_count, i.created_at
     limit 1
     for update skip locked;
  end if;

  if v_id is null then
    return;
  end if;

  return query
  update public.image_library
     set used_count = used_count + 1,
         last_used_at = now()
   where id = v_id
  returning *;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPC: library stock per client
-- ---------------------------------------------------------------------------------------------
-- upcoming_auto_posts = approved or pending posts that will draw a library image at publish
-- time, used to project when the library runs out.
create or replace function public.library_stock(p_client_id uuid default null)
returns table (
  client_id uuid,
  total_images integer,
  unused_images integer,
  upcoming_auto_posts integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         coalesce(img.total, 0)::integer,
         coalesce(img.unused, 0)::integer,
         coalesce(up.cnt, 0)::integer
    from public.clients c
    left join lateral (
      select count(*) as total,
             count(*) filter (where i.used_count = 0) as unused
        from public.image_library i
       where i.client_id = c.id and i.is_active
    ) img on true
    left join lateral (
      select count(*) as cnt
        from public.posts p
        join public.locations l on l.id = p.location_id
       where l.client_id = c.id
         and p.image_source = 'auto'
         and p.status in ('pending_approval', 'scheduled')
    ) up on true
   where p_client_id is null or c.id = p_client_id;
$$;

-- These functions are for the service role only.
revoke all on function public.claim_due_posts(integer, integer) from public, anon, authenticated;
revoke all on function public.pick_library_image(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.library_stock(uuid) from public, anon, authenticated;
grant execute on function public.claim_due_posts(integer, integer) to service_role;
grant execute on function public.pick_library_image(uuid, uuid, boolean) to service_role;
grant execute on function public.library_stock(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Storage: public bucket for post images (Google fetches media by public URL)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do update set public = true;
