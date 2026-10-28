import { Hono } from 'hono';
import { getSettings } from '../db/settings.js';
import type { AuthEnv } from '../middleware/auth.js';

export const settingsRoutes = new Hono<AuthEnv>().get('/', async (c) => c.json(await getSettings()));
