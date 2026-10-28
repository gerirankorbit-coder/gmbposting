/**
 * Centralised access to server-side environment variables. Values are read lazily so a
 * missing optional variable never crashes unrelated routes.
 */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}

export function optionalEnv(name: string, fallback?: string): string | undefined {
  return read(name) ?? fallback;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(`Server is missing the ${variable} environment variable.`);
    this.name = 'MissingEnvError';
  }
}

export const env = {
  get appUrl() {
    return (read('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  },
  get defaultTimezone() {
    return read('DEFAULT_TIMEZONE') ?? 'Asia/Karachi';
  },
  get lowStockThreshold() {
    const n = Number(read('IMAGE_LOW_STOCK_THRESHOLD') ?? '5');
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
  },
  get storageBucket() {
    return read('SUPABASE_STORAGE_BUCKET') ?? 'post-media';
  },
};

/** Which integrations are configured, used by /api/health (never exposes values). */
export function configSummary(): Record<string, boolean> {
  const has = (...names: string[]) => names.every((n) => !!read(n));
  return {
    clerk: has('CLERK_SECRET_KEY'),
    supabase: has('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
    google: has('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'),
    security: has('TOKEN_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET', 'CRON_SECRET'),
    gemini: has('GEMINI_API_KEY'),
    email: has('RESEND_API_KEY', 'NOTIFY_FROM_EMAIL', 'NOTIFY_TO_EMAILS'),
  };
}
