import { Hono } from 'hono';
import { activityQuerySchema, roleUpdateSchema, settingsUpdateSchema } from '../../shared/schemas.js';
import type { ActivityDTO, Paginated } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { dbError, ilikePattern, pageRange } from '../db/helpers.js';
import { getSettings, updateSettings } from '../db/settings.js';
import { db } from '../db/supabase.js';
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

export const teamRoutes = new Hono<AuthEnv>()
  .get('/', requireRole('admin'), async (c) => c.json(await listTeam(c.req.query('refresh') === '1')))
  .patch('/:userId', requireRole('admin'), async (c) => {
    const { role } = await parseBody(c, roleUpdateSchema);
    const userId = c.req.param('userId');
    const team = await listTeam(true);
    const target = team.find((u) => u.id === userId);
    if (!target) throw notFound('Team member not found.');
    if (target.role === 'admin' && role !== 'admin' && team.filter((u) => u.role === 'admin').length <= 1) {
      throw badRequest('There must be at least one admin.');
    }
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
