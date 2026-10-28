import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiErrorBody, HealthStatus } from '../shared/types.js';
import { configSummary, MissingEnvError } from './lib/env.js';
import { ApiError } from './lib/errors.js';
import { requireAuth, type AuthEnv } from './middleware/auth.js';
import { meRoutes } from './routes/me.js';

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
app.get('/health', (c) => {
  const body: HealthStatus = {
    ok: true,
    time: new Date().toISOString(),
    version: VERSION,
    config: configSummary(),
  };
  return c.json(body);
});

// --- Authenticated routes ------------------------------------------------------------------
// Everything below requires a valid Clerk session. Public exceptions (Google OAuth callback,
// cron publisher) are registered above this line in later phases.
app.use('*', requireAuth);
app.route('/me', meRoutes);

export type AppType = typeof app;
