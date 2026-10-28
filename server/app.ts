import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiErrorBody, HealthStatus } from '../shared/types.js';
import { db } from './db/supabase.js';
import { configSummary, MissingEnvError } from './lib/env.js';
import { ApiError } from './lib/errors.js';
import { requireAuth, type AuthEnv } from './middleware/auth.js';
import { aiRoutes } from './routes/ai.js';
import { clientRoutes } from './routes/clients.js';
import { connectionRoutes } from './routes/connections.js';
import { googleCallbackRoutes, googleRoutes } from './routes/google.js';
import { locationRoutes } from './routes/locations.js';
import { meRoutes } from './routes/me.js';
import { postRoutes } from './routes/posts.js';
import { settingsRoutes } from './routes/settings.js';
import { uploadRoutes } from './routes/uploads.js';

const VERSION = '0.1.0';

export const app = new Hono<AuthEnv>().basePath('/api');

app.onError((err, c) => {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return c.json(body, err.status);
  }
  if (err instanceof MissingEnvError) {
    console.error(`[config] ${err.message}`);
    return c.json<ApiErrorBody>(
      { error: { code: 'server_misconfigured', message: err.message } },
      500,
    );
  }
  if (err instanceof HTTPException) {
    return c.json<ApiErrorBody>(
      { error: { code: 'http_error', message: err.message || 'Request failed.' } },
      err.status,
    );
  }
  console.error('[unhandled]', err);
  return c.json<ApiErrorBody>(
    { error: { code: 'internal_error', message: 'Something went wrong on our side.' } },
    500,
  );
});

app.notFound((c) =>
  c.json<ApiErrorBody>({ error: { code: 'not_found', message: 'Unknown API route.' } }, 404),
);

// --- Public routes -------------------------------------------------------------------------
app.get('/health', async (c) => {
  const config = configSummary();
  let database: boolean | null = null;
  if (config.supabase) {
    const { error } = await db().from('app_settings').select('key').limit(1);
    database = !error;
    if (error) console.error('[health] database check failed:', error.message);
  }
  const body: HealthStatus = {
    ok: database !== false,
    time: new Date().toISOString(),
    version: VERSION,
    config,
    database,
  };
  return c.json(body, database === false ? 503 : 200);
});

// Google OAuth callback: public, protected by the HMAC-signed state parameter.
app.route('/google', googleCallbackRoutes);

// --- Authenticated routes ------------------------------------------------------------------
// Everything below requires a valid Clerk session. Public routes must be registered above.
app.use('*', requireAuth);
app.route('/me', meRoutes);
app.route('/google', googleRoutes);
app.route('/connections', connectionRoutes);
app.route('/locations', locationRoutes);
app.route('/clients', clientRoutes);
app.route('/uploads', uploadRoutes);
app.route('/ai', aiRoutes);
app.route('/posts', postRoutes);
app.route('/settings', settingsRoutes);

export type AppType = typeof app;
