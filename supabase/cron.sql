-- OrbitPost: scheduled jobs (run in the Supabase SQL editor AFTER 001_init.sql).
--
-- Vercel Hobby cron can only run once a day, so Supabase calls the publisher every 5 minutes.
-- BEFORE RUNNING, replace both placeholders everywhere in this file:
--   https://YOUR-APP.vercel.app   -> your APP_URL (no trailing slash)
--   YOUR_CRON_SECRET              -> the CRON_SECRET value set in Vercel
-- Re-running this file is safe: existing jobs with the same names are replaced.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove previous versions of the jobs.
select cron.unschedule(jobid) from cron.job where jobname in ('orbitpost-publish', 'orbitpost-daily');

-- Publish due posts every 5 minutes.
select cron.schedule(
  'orbitpost-publish',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/cron/publish',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Daily maintenance at 02:10 UTC: library stock checks, account sync, email digest.
select cron.schedule(
  'orbitpost-daily',
  '10 2 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/cron/daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Check it is working (after ~5 minutes):
--   select jobname, schedule, active from cron.job;
--   select status_code, created, left(content::text, 200) from net._http_response order by created desc limit 5;
-- A 200 status with {"processed":...} means the publisher ran. 401 means the secret is wrong.
