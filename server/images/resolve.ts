import type { BrandedTemplate, ImageSource } from '../../shared/types.js';
import { unwrap, unwrapOne } from '../db/helpers.js';
import { db } from '../db/supabase.js';
import type { ClientRow, PostRow } from '../db/types.js';
import { generateBrandedImage } from './branded.js';
import { checkStock, pickLibraryImage } from './library.js';

export interface ResolvedImage {
  image_source: ImageSource;
  media_url: string | null;
  media_path: string | null;
  image_library_id: string | null;
  branded_template: string | null;
}

async function loadContext(post: Pick<PostRow, 'location_id'>) {
  const loc = unwrapOne(
    await db().from('locations').select('id, title, city, client:clients(*)').eq('id', post.location_id).maybeSingle(),
    'Location',
  );
  return { loc, client: (loc.client as ClientRow | null) ?? null };
}

/**
 * Resolves an `auto` image at publish time: next unused library image, else (per client
 * setting) a branded graphic or the least recently used image. Saves the result on the post.
 */
export async function resolveAutoImage(post: PostRow): Promise<ResolvedImage> {
  const { loc, client } = await loadContext(post);
  let resolved: ResolvedImage = { image_source: 'none', media_url: null, media_path: null, image_library_id: null, branded_template: null };

  if (client) {
    const picked = await pickLibraryImage(client.id, loc.id, client.on_library_exhausted === 'recycle');
    if (picked) {
      resolved = { image_source: 'library', media_url: picked.public_url, media_path: picked.storage_path, image_library_id: picked.id, branded_template: null };
    } else {
      const branded = await generateBrandedImage({
        client,
        businessName: loc.title,
        city: loc.city,
        summary: post.summary || post.event_title || '',
        topicType: post.topic_type,
      });
      resolved = { image_source: 'branded', media_url: branded.url, media_path: branded.path, image_library_id: null, branded_template: branded.template };
    }
    await checkStock(client);
  }

  unwrap(await db().from('posts').update(resolved).eq('id', post.id), 'Save resolved image');
  return resolved;
}

/** (Re)generates a branded graphic for a post, optionally forcing a template. */
export async function regenerateBranded(post: PostRow, template?: BrandedTemplate): Promise<ResolvedImage> {
  const { loc, client } = await loadContext(post);
  if (!client) throw new Error('Assign this location to a client before generating branded graphics.');
  const branded = await generateBrandedImage({
    client,
    businessName: loc.title,
    city: loc.city,
    summary: post.summary || post.event_title || '',
    topicType: post.topic_type,
    template,
  });
  const resolved: ResolvedImage = { image_source: 'branded', media_url: branded.url, media_path: branded.path, image_library_id: null, branded_template: branded.template };
  unwrap(await db().from('posts').update(resolved).eq('id', post.id), 'Save branded image');
  return resolved;
}
