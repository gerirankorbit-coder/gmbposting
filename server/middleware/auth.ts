import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { hasRole, ROLES, type Role } from '../../shared/types.js';
import { requireEnv } from '../lib/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  role: Role;
}

export type AuthEnv = { Variables: { user: AuthUser } };

let clerk: ClerkClient | null = null;
export function getClerk(): ClerkClient {
  clerk ??= createClerkClient({ secretKey: requireEnv('CLERK_SECRET_KEY') });
  return clerk;
}

// Warm-instance cache so we don't hit the Clerk API on every request.
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<string, { user: AuthUser; expires: number }>();

export function invalidateUserCache(userId?: string) {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

/**
 * Resolves the user's role. A user without a role becomes `admin` when no admin exists yet
 * (the very first team member), otherwise `writer`. The role is persisted to Clerk.
 */
async function resolveRole(userId: string, current: unknown): Promise<Role> {
  const role = parseRole(current);
  if (role) return role;
  const client = getClerk();
  const users = await client.users.getUserList({ limit: 200 });
  const adminExists = users.data.some(
    (u) => u.id !== userId && parseRole(u.publicMetadata?.role) === 'admin',
  );
  const assigned: Role = adminExists ? 'writer' : 'admin';
  await client.users.updateUserMetadata(userId, { publicMetadata: { role: assigned } });
  return assigned;
}

async function loadUser(userId: string): Promise<AuthUser> {
  const cached = userCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.user;
  const u = await getClerk().users.getUser(userId);
  const role = await resolveRole(userId, u.publicMetadata?.role);
  const primaryEmail =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
    u.emailAddresses[0]?.emailAddress ??
    null;
  const user: AuthUser = {
    id: u.id,
    email: primaryEmail,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || primaryEmail,
    imageUrl: u.imageUrl ?? null,
    role,
  };
  userCache.set(userId, { user, expires: Date.now() + USER_CACHE_TTL_MS });
  return user;
}

/** Verifies the Clerk session token sent as `Authorization: Bearer <token>`. */
export const requireAuth: MiddlewareHandler<AuthEnv> = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) throw unauthorized();
  let sub: string;
  try {
    const payload = await verifyToken(token, { secretKey: requireEnv('CLERK_SECRET_KEY') });
    sub = payload.sub;
  } catch (err) {
    if (err instanceof Error && err.name === 'MissingEnvError') throw err;
    throw unauthorized('Your session is invalid or has expired. Please sign in again.');
  }
  c.set('user', await loadUser(sub));
  await next();
});

/** Role guard; use after `requireAuth`. */
export function requireRole(role: Role): MiddlewareHandler<AuthEnv> {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user');
    if (!hasRole(user?.role, role)) {
      throw forbidden(`This action requires the ${role} role.`);
    }
    await next();
  });
}
