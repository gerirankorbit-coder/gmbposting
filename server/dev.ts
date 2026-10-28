/**
 * Local API server for `npm run dev:api` (Vite proxies /api here). `vercel dev` is the
 * alternative that runs the real serverless function.
 */
import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`OrbitPost API listening on http://localhost:${info.port}/api`);
});
