import { Hono } from 'hono';
import { createPostsSchema } from '../../shared/schemas.js';
import { hasRole, type CreatePostsResult } from '../../shared/types.js';
import { logActivity } from '../db/activity.js';
import { unwrapOne } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { forbidden } from '../lib/errors.js';
import { parseBody } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';
import { createPosts } from '../posts/create.js';

export const postRoutes = new Hono<AuthEnv>().post('/', async (c) => {
  const user = c.get('user');
  const body = await parseBody(c, createPostsSchema);
  if (body.mode === 'approve' && !hasRole(user.role, 'manager')) {
    throw forbidden('Only managers and admins can approve and schedule posts.');
  }

  let campaignId: string | null = null;
  if (body.campaign) {
    const campaign = unwrapOne(
      await db()
        .from('campaigns')
        .insert({
          name: body.campaign.name,
          base_prompt: body.campaign.base_prompt,
          topic_type: body.posts[0]?.topic_type ?? null,
          created_by: user.id,
        })
        .select('id')
        .single(),
      'Create campaign',
    );
    campaignId = campaign.id;
  }

  let result;
  try {
    result = await createPosts({
      posts: body.posts,
      mode: body.mode,
      repeatWeeks: body.repeatWeeks,
      actorId: user.id,
      campaignId,
    });
  } catch (err) {
    if (campaignId) await db().from('campaigns').delete().eq('id', campaignId);
    throw err;
  }

  await logActivity({
    actor: user.id,
    action: body.mode === 'draft' ? 'posts.drafted' : body.mode === 'approve' ? 'posts.approved_and_scheduled' : 'posts.submitted',
    entityType: campaignId ? 'campaign' : 'post',
    entityId: campaignId ?? result.ids[0] ?? null,
    details: { count: result.ids.length, status: result.status, campaign: body.campaign?.name ?? null },
  });
  const dto: CreatePostsResult = {
    campaign_id: campaignId,
    created: result.ids.length,
    status: result.status,
    post_ids: result.ids,
  };
  return c.json(dto, 201);
});
