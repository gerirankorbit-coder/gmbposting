-- Track where a location's time zone came from so sync can fill it from the address
-- without overwriting a zone the team chose by hand.
alter table public.locations
  add column if not exists timezone_source text not null default 'default'
  check (timezone_source in ('default', 'auto', 'manual'));
