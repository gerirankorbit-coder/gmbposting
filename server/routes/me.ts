import { Hono } from 'hono';
import type { Me } from '../../shared/types.js';
import type { AuthEnv } from '../middleware/auth.js';

export const meRoutes = new Hono<AuthEnv>().get('/', (c) => {
  const user = c.get('user');
  const me: Me = {
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
    role: user.role,
  };
  return c.json(me);
});
