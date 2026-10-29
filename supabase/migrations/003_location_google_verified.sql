-- Whether Google lets us post on this location: verified and in good standing (from the
-- Business Information metadata). null = not known yet (filled on the next sync).
alter table public.locations add column if not exists google_verified boolean;
