# OrbitPost by Rank Orbit

Google Business Profile posting platform for Rank Orbit LLC: connect Gmail accounts, sync
Business Profiles, compose or bulk-import posts, approve them, and publish on schedule through
the official Google Business Profile APIs.

> Status: **Phase 1 (scaffold)** complete. The full setup guide is written in the final phase.

## Stack

React 18 + Vite + TypeScript, Tailwind v3 + shadcn/ui, TanStack Query, Clerk, Hono on a single
Vercel function (`api/[[...route]].ts`), Supabase (Postgres + Storage), Gemini.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev:api              # Hono API on http://localhost:3001
npm run dev                  # Vite on http://localhost:5173 (proxies /api)
```

Or run `vercel dev` to serve the SPA and the real serverless function together.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Local Hono API server (reads `.env.local` / `.env`) |
| `npm run typecheck` | Type-checks the client, server and config projects |
| `npm run build` | Production build of the SPA into `dist/` |

## Routing on Vercel

All API endpoints live in one function. `vercel.json` rewrites `/api/:path*` to
`api/[[...route]].ts`, because outside Next.js Vercel treats the optional catch-all filename as a
single path segment; without the rewrite, nested paths such as `/api/cron/publish` would 404.
