import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { SYSTEM_ACTOR } from '../db/activity.js';
import { requireEnv } from '../lib/env.js';
import { unauthorized } from '../lib/errors.js';
import { runDaily } from '../publisher/daily.js';
import { runPublisher } from '../publisher/run.js';
import { requireRole, type AuthEnv } from '../middleware/auth.js';

/** Vercel Cron and pg_cron both send `Authorization: Bearer <CRON_SECRET>`. */
function assertCronSecret(c: Context) {
  const expected = Buffer.from(`Bearer ${requireEnv('CRON_SECRET')}`);
  const got = Buffer.from(c.req.header('authorization') ?? '');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw unauthorized('Invalid cron secret.');
}

const publish = async (c: Context) => {
  assertCronSecret(c);
  return c.json(await runPublisher({ actor: SYSTEM_ACTOR }));
};

const daily = async (c: Context) => {
  assertCronSecret(c);
  return c.json(await runDaily());
};

/** Public routes protected by CRON_SECRET (Vercel Cron uses GET; pg_cron uses POST). */
export const cronRoutes = new Hono().get('/publish', publish).post('/publish', publish).get('/daily', daily).post('/daily', daily);

/** Authenticated: admins can run the publisher from the Settings page. */
export const publisherRoutes = new Hono<AuthEnv>().post('/run', requireRole('admin'), async (c) =>
  c.json(await runPublisher({ actor: c.get('user').id })),
);
