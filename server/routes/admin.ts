import { Hono } from 'hono';
import { activityQuerySchema, inviteSchema, roleUpdateSchema, settingsUpdateSchema } from '../../shared/schemas.js';
import { ROLES, type ActivityDTO, type InvitationDTO, type Paginated, type Role, type TeamMemberDTO } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { dbError, ilikePattern, pageRange } from '../db/helpers.js';
import { getSettings, updateSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
import { env } from '../lib/env.js';
import { badRequest, notFound } from '../lib/errors.js';
import { actorNames, clearTeamCache, listTeam } from '../lib/users.js';
import { parseBody, parseQuery } from '../lib/validate.js';
import { getClerk, invalidateUserCache, requireRole, type AuthEnv } from '../middleware/auth.js';

export const settingsRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => c.json(await getSettings()))
  .patch('/', requireRole('admin'), async (c) => {
    const body = await parseBody(c, settingsUpdateSchema);
    const settings = await updateSettings(body);
    await logActivity({ actor: c.get('user').id, action: 'settings.updated', entityType: 'settings', details: { ...body } });
    return c.json(settings);
  });

function inviteRole(meta: Record<string, unknown> | null): Role | null {
  const r = meta?.role;
  return typeof r === 'string' && (ROLES as readonly string[]).includes(r) ? (r as Role) : null;
}

function assertNotLastAdmin(team: TeamMemberDTO[], target: TeamMemberDTO, nextRole: Role | null) {
  if (target.role === 'admin' && nextRole !== 'admin' && team.filter((u) => u.role === 'admin').length <= 1) {
    throw badRequest('There must be at least one admin.');
  }
}

/**
 * Access is invite-only. Admins invite by email (Clerk sends the email; the role travels with the
 * invitation), grant a role to someone who signed up uninvited, or remove a member's access.
 */
export const teamRoutes = new Hono<AuthEnv>()
  // Always read Clerk directly: the 5-minute cache is per server instance, so a member who just
  // accepted an invitation could stay missing from this list. (actorNames keeps using the cache.)
  .get('/', requireRole('admin'), async (c) => c.json(await listTeam(true)))
  .get('/invitations', requireRole('admin'), async (c) => {
    const list = await getClerk().invitations.getInvitationList({ status: 'pending', limit: 100 });
    const body: InvitationDTO[] = list.data.map((i) => ({
      id: i.id,
      email: i.emailAddress,
      role: inviteRole(i.publicMetadata),
      created_at: new Date(i.createdAt).toISOString(),
    }));
    return c.json(body);
  })
  .post('/invitations', requireRole('admin'), async (c) => {
    const { email, role } = await parseBody(c, inviteSchema);
    const actor = c.get('user').id;
    const existing = (await listTeam(true)).find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      if (existing.role) throw badRequest(`${email} is already on the team as ${existing.role}.`);
      // Signed up before being invited: just grant the role.
      await getClerk().users.updateUserMetadata(existing.id, { publicMetadata: { role } });
      invalidateUserCache(existing.id);
      clearTeamCache();
      await logActivity({ actor, action: 'team.access_granted', entityType: 'user', entityId: existing.id, details: { email, role } });
      return c.json({ granted: true as const, email, role });
    }
    const inv = await getClerk().invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
      redirectUrl: `${env.appUrl}/sign-up`,
      notify: true,
      ignoreExisting: true,
    });
    await logActivity({ actor, action: 'team.invited', entityType: 'user', entityId: null, details: { email, role } });
    return c.json({ granted: false as const, email, role, invitation_id: inv.id }, 201);
  })
  .delete('/invitations/:id', requireRole('admin'), async (c) => {
    const inv = await getClerk().invitations.revokeInvitation(c.req.param('id'));
    await logActivity({ actor: c.get('user').id, action: 'team.invite_revoked', entityType: 'user', entityId: null, details: { email: inv.emailAddress } });
    return c.json({ ok: true });
  })
  .delete('/:userId/access', requireRole('admin'), async (c) => {
    const userId = c.req.param('userId');
    if (userId === c.get('user').id) throw badRequest('You cannot remove your own access.');
    const team = await listTeam(true);
    const target = team.find((u) => u.id === userId);
    if (!target) throw notFound('Team member not found.');
    assertNotLastAdmin(team, target, null);
    await getClerk().users.updateUserMetadata(userId, { publicMetadata: { role: null } });
    invalidateUserCache(userId);
    clearTeamCache();
    await logActivity({ actor: c.get('user').id, action: 'team.access_removed', entityType: 'user', entityId: userId, details: { name: target.name ?? target.email, from: target.role } });
    return c.json({ ...target, role: null });
  })
  .patch('/:userId', requireRole('admin'), async (c) => {
    const { role } = await parseBody(c, roleUpdateSchema);
    const userId = c.req.param('userId');
    const team = await listTeam(true);
    const target = team.find((u) => u.id === userId);
    if (!target) throw notFound('Team member not found.');
    assertNotLastAdmin(team, target, role);
    await getClerk().users.updateUserMetadata(userId, { publicMetadata: { role } });
    invalidateUserCache(userId);
    clearTeamCache();
    await logActivity({ actor: c.get('user').id, action: 'team.role_changed', entityType: 'user', entityId: userId, details: { name: target.name ?? target.email, from: target.role, to: role } });
    return c.json({ ...target, role });
  });

export const activityRoutes = new Hono<AuthEnv>().get('/', async (c) => {
  const q = parseQuery(c, activityQuerySchema);
  let query = db().from('activity_log').select('*', { count: 'exact' });
  if (q.entityType) query = query.eq('entity_type', q.entityType);
  if (q.actor) query = query.eq('actor', q.actor);
  if (q.search) query = query.ilike('action', ilikePattern(q.search));
  const [from, to] = pageRange(q.page, q.pageSize);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw dbError(error, 'Load activity');
  const names = await actorNames((data ?? []).map((a) => a.actor));
  const body: Paginated<ActivityDTO> = {
    items: (data ?? []).map((a) => ({
      id: a.id,
      actor: a.actor,
      actor_name: names.get(a.actor) ?? 'Former team member',
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      details: (a.details ?? {}) as Record<string, unknown>,
      created_at: a.created_at,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  };
  return c.json(body);
});
