import { Hono } from 'hono';
import { aiVariationsSchema } from '../../shared/schemas.js';
import type { VariationDTO } from '../../shared/types.js';
import { generateVariations, type VariationContext } from '../ai/gemini.js';
import { logActivity } from '../db/activity.js';
import { unwrap } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import { badRequest } from '../lib/errors.js';
import { parseBody } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';

export const aiRoutes = new Hono<AuthEnv>().post('/variations', async (c) => {
  const body = await parseBody(c, aiVariationsSchema);
  const rows = unwrap(
    await db()
      .from('locations')
      .select('id, title, primary_category, city, service_area_text, client:clients(name, brand_voice)')
      .in('id', body.locationIds),
    'Load locations',
  );
  if (rows.length !== new Set(body.locationIds).size) throw badRequest('Some locations no longer exist.');
  const byId = new Map(rows.map((r) => [r.id, r]));
  const contexts: VariationContext[] = body.locationIds.map((id) => {
    const r = byId.get(id)!;
    return {
      location_id: r.id,
      business: r.title,
      category: r.primary_category,
      city: r.city,
      serviceArea: r.service_area_text,
      brandVoice: r.client?.brand_voice ?? null,
    };
  });
  const variations: VariationDTO[] = await generateVariations({
    brief: body.brief,
    topicType: body.topicType,
    tone: body.tone,
    ctaType: body.ctaType,
    locations: contexts,
    avoid: body.avoid,
  });
  await logActivity({
    actor: c.get('user').id,
    action: 'ai.variations_generated',
    entityType: 'location',
    details: { count: variations.length, topicType: body.topicType },
  });
  return c.json(variations);
});
