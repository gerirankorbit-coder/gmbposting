# OrbitPost by Rank Orbit

Google Business Profile posting platform for Rank Orbit LLC: connect Gmail accounts, sync
Business Profiles, compose or bulk-import posts, approve them, and publish on schedule through
the official Google Business Profile APIs.

> Status: **Phases 1–4 (scaffold, database, Google connect + sync, compose + media + AI)** complete. The full setup guide is written in the final phase.

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

## Database

`supabase/migrations/001_init.sql` creates every table, index, `updated_at` trigger, the
service-role-only RPCs (`claim_due_posts`, `pick_library_image`, `library_stock`) and the public
`post-media` storage bucket. RLS is enabled on every table with no policies, so only the server's
service-role key can read or write data. `GET /api/health` reports whether the database is
reachable.

## Google connect and sync

- `POST /api/google/connect` (admin) returns the Google consent URL; the browser navigates to it.
- `GET /api/google/callback` is public and protected by an HMAC-signed, 10-minute `state`. It
  exchanges the code, stores AES-256-GCM-encrypted tokens, reuses the existing row when the same
  Google account reconnects, then redirects to `/connections`, which starts the first sync.
- `POST /api/connections/:id/sync` lists accounts and locations, upserts `locations` and
  `location_access`, auto-creates a client per new location (reusing a client with the same name),
  and removes access rows that were not seen (only when every account listed successfully).
- All Google calls go through `server/google/client.ts`: token refresh within 2 minutes of expiry,
  one forced refresh on 401, backoff on 429/5xx (1s, 2s, 4s), a per-instance throttle well under the
  300 requests/minute quota, and `invalid_grant` marks the connection `needs_reauth` and notifies
  the team.

## Compose, uploads and AI

- **Uploads** are two-step because Vercel functions accept at most 4.5 MB request bodies: the
  browser asks `POST /api/uploads/sign` for a one-time signed Storage URL, PUTs the raw file
  (up to 15 MB) to `post-media/incoming/…`, then calls `POST /api/uploads/complete`. The server
  converts HEIC, auto-rotates, strips metadata, converts to JPG, resizes to a 1600px long edge,
  rejects images under 400×300, compresses under 1.5 MB, stores the result under `uploads/` and
  deletes the raw file.
- **AI variations**: `POST /api/ai/variations` writes one unique post per location with Gemini
  (batches of 8 locations per call, strict JSON validated with zod, one retry on invalid output).
  `GEMINI_MODEL` defaults to `gemini-flash-latest`, Google's alias for the current Flash model.
- **Posts**: `POST /api/posts` validates that each chosen Gmail can manage its location, fills
  the button link from the client's default link or the location's website, and creates posts as
  `draft`, `pending_approval` (or `scheduled` when approvals are off), or `scheduled` via
  "Approve & schedule" (manager+). "Repeat weekly" creates one copy per week.
