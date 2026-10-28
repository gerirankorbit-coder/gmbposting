/** Error raised for failed Google API calls, carrying a human-readable message. */
export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

/** The connection's refresh token is no longer valid; the user must reconnect. */
export class ReauthRequiredError extends Error {
  constructor(
    public readonly connectionId: string,
    message = 'Google access was revoked or expired. Reconnect this Google account.',
  ) {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

interface GoogleErrorJson {
  error?:
    | string
    | {
        code?: number;
        message?: string;
        status?: string;
        details?: Array<{
          reason?: string;
          '@type'?: string;
          fieldViolations?: Array<{ field?: string; description?: string }>;
          errorDetails?: Array<{ message?: string; field?: string }>;
        }>;
      };
  error_description?: string;
}

/** Converts a Google error response body into a readable message and reason code. */
export function parseGoogleError(status: number, bodyText: string): { message: string; reason?: string } {
  let json: GoogleErrorJson | null = null;
  try {
    json = JSON.parse(bodyText) as GoogleErrorJson;
  } catch {
    json = null;
  }
  if (!json?.error) {
    const snippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 200);
    return { message: `Google returned HTTP ${status}${snippet ? `: ${snippet}` : ''}` };
  }
  if (typeof json.error === 'string') {
    return {
      message: json.error_description ? `${json.error}: ${json.error_description}` : json.error,
      reason: json.error,
    };
  }
  const err = json.error;
  const parts: string[] = [err.message ?? `HTTP ${status}`];
  let reason: string | undefined = err.status;
  for (const d of err.details ?? []) {
    if (d.reason) reason = d.reason;
    for (const v of d.fieldViolations ?? []) {
      if (v.description) parts.push(v.field ? `${v.field}: ${v.description}` : v.description);
    }
    for (const e of d.errorDetails ?? []) {
      if (e.message) parts.push(e.field ? `${e.field}: ${e.message}` : e.message);
    }
  }
  return { message: Array.from(new Set(parts)).join(' | ').slice(0, 1000), reason };
}
