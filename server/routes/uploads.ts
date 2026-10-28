import { Hono } from 'hono';
import { uploadCompleteSchema, uploadSignSchema } from '../../shared/schemas.js';
import type { SignedUploadDTO, UploadedImageDTO } from '../../shared/types.js';
import { forbidden } from '../lib/errors.js';
import { createSignedUpload } from '../lib/storage.js';
import { parseBody } from '../lib/validate.js';
import type { AuthEnv } from '../middleware/auth.js';
import { incomingPath, processIncoming, storeProcessed } from '../images/incoming.js';

/**
 * Two-step upload. Vercel functions accept at most 4.5 MB request bodies, so the browser PUTs the
 * raw file (up to 15 MB) to a one-time signed Storage URL, then asks the API to process it.
 */
export const uploadRoutes = new Hono<AuthEnv>()
  .post('/sign', async (c) => {
    const body = await parseBody(c, uploadSignSchema);
    const signed = await createSignedUpload(incomingPath(c.get('user').id, body.filename));
    const dto: SignedUploadDTO = { signedUrl: signed.signedUrl, path: signed.path };
    return c.json(dto);
  })

  .post('/complete', async (c) => {
    const { path } = await parseBody(c, uploadCompleteSchema);
    const owner = path.split('/')[1];
    if (owner !== c.get('user').id.replace(/[^\w-]/g, '')) throw forbidden('This upload belongs to someone else.');
    const image = await processIncoming(path);
    const stored = await storeProcessed('uploads', image);
    const dto: UploadedImageDTO = {
      url: stored.url,
      path: stored.path,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
    };
    return c.json(dto);
  });
