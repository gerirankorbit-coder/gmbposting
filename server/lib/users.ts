import { ROLES, type Role, type TeamMemberDTO } from '../../shared/types.js';
import { getClerk } from '../middleware/auth.js';

const TTL_MS = 5 * 60_000;
let cache: { at: number; users: TeamMemberDTO[] } | null = null;

function parseRole(v: unknown): Role | null {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v) ? (v as Role) : null;
}

/** Team members from Clerk (cached for 5 minutes per instance). */
export async function listTeam(force = false): Promise<TeamMemberDTO[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.users;
  const users: TeamMemberDTO[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await getClerk().users.getUserList({ limit: 100, offset, orderBy: '-created_at' });
    for (const u of page.data) {
      const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
      users.push({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null,
        email,
        image_url: u.imageUrl ?? null,
        role: parseRole(u.publicMetadata?.role),
        last_sign_in_at: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      });
    }
    if (page.data.length < 100) break;
  }
  cache = { at: Date.now(), users };
  return users;
}

export function clearTeamCache() {
  cache = null;
}

/** Maps actor ids (Clerk ids or "system") to display names; never throws. */
export async function actorNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>([['system', 'System'], ['google-import', 'Google import']]);
  if (!ids.some((id) => !map.has(id))) return map;
  try {
    for (const u of await listTeam()) map.set(u.id, u.name ?? u.email ?? 'Team member');
  } catch (err) {
    console.error('[users] could not load team', err instanceof Error ? err.message : err);
  }
  return map;
}
