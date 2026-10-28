import { requireEnv } from '../lib/env.js';
import { GoogleApiError, parseGoogleError } from './errors.js';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/business.manage',
];

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function buildAuthUrl(state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await postForm(TOKEN_URL, {
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    ...body,
  });
  const text = await res.text();
  if (!res.ok) {
    const { message, reason } = parseGoogleError(res.status, text);
    throw new GoogleApiError(res.status, message, reason);
  }
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    code,
    grant_type: 'authorization_code',
    redirect_uri: requireEnv('GOOGLE_REDIRECT_URI'),
  });
}

/** Throws GoogleApiError with reason `invalid_grant` when the refresh token is dead. */
export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  if (!res.ok) {
    const { message, reason } = parseGoogleError(res.status, text);
    throw new GoogleApiError(res.status, message, reason);
  }
  return JSON.parse(text) as GoogleUserInfo;
}

/** Best-effort token revocation; returns false when Google rejects it (e.g. already revoked). */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await postForm(REVOKE_URL, { token });
    return res.ok;
  } catch {
    return false;
  }
}
