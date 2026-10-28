# OrbitPost by Rank Orbit

Google Business Profile posting platform for Rank Orbit LLC: connect Gmail accounts, sync
Business Profiles, compose or bulk-import posts, approve them, and publish on schedule through
the official Google Business Profile APIs.

> Status: **Phases 1–8** complete (scaffold, database, Google connect + sync, compose + media + AI, approvals/calendar/queue, image library + branded graphics + notifications, spreadsheet import, publisher). The full setup guide is written in the final phase.

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

## Post workflow

| Action | Who | From status → to status |
| --- | --- | --- |
| Submit | writer+ | draft → pending_approval (or scheduled when approvals are off) |
| Approve & schedule | manager+ | pending_approval / draft → scheduled |
| Send back (with note) | manager+ | pending_approval / scheduled → draft |
| Edit | writer+ (drafts, pending); manager+ (scheduled, failed) | unchanged |
| Reschedule / drag on calendar | manager+ | draft, pending, scheduled, failed (failed → scheduled) |
| Retry now | manager+ | failed → scheduled (attempts reset) |
| Cancel | manager+ | draft, pending, scheduled, failed → cancelled |
| Delete from Google | admin | published → cancelled (post removed on Google) |
| Delete record | writer (own drafts), manager+ | never-published posts only |

Every rule is enforced on the server; the UI only hides actions a role cannot take.

## Image library, branded graphics and notifications

- **Library**: images are processed like post uploads, stored under `post-media/library/<client_id>/`,
  and exact duplicates (same processed bytes) are skipped. ZIP files are unpacked in the browser.
  An image can be limited to one location.
- **Picking** (`pick_library_image` RPC, atomic): location-specific unused images first, then
  client-wide, oldest first. An image is never reused while unused ones remain. When none are left,
  the client setting decides: a branded graphic (default) or the least recently used image.
  `auto` posts resolve their image at publish time (`server/images/resolve.ts`), so a library
  refilled after scheduling is used automatically.
- **Branded graphics** (`server/images/branded.ts`): 1200×900 PNGs rendered with satori + resvg in
  four templates (bold gradient, logo split, minimal card, badge for offers/events) using the
  client's brand kit, with a 3–8 word Gemini headline (heuristic fallback). Templates and colour
  variations rotate per client. Fonts are bundled from `server/assets/fonts` (Plus Jakarta Sans,
  SIL OFL) via `includeFiles` in `vercel.json`.
- **Stock alerts**: after every pick, upload or settings change (and daily), each client's stock
  state (`ok` / `low` / `empty`) is recomputed and the team is notified once per change:
  `library_low`, `library_empty`, then `library_refilled` when images are added.
- **Email**: when `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` and `NOTIFY_TO_EMAILS` are set, low/empty
  library, reconnect and final post-failure alerts are emailed as one digest at most once an hour.

## Spreadsheet import

- Download the template on the Import page (`orbitpost-template.xlsx`: a `Posts` sheet and an
  `Instructions` sheet). Header names are case-insensitive and common aliases work.
- The browser parses XLSX/CSV with SheetJS; the server matches each row: Gmail → connected
  account, then `location_id` or the business name (normalised exact match, then fuzzy match,
  `city` breaks ties) among locations that Gmail can manage.
- Image URLs are downloaded server-side in time-boxed batches (Drive/Dropbox share links are
  converted; private network addresses are refused). Filenames are matched to images uploaded
  with the sheet. Failed images fall back to Auto.
- Rows without a date publish ASAP or are spread across a date range (09:00–18:00 by default, in
  each location's time zone, at most one post per location per day).
- **SheetJS source:** the spec asks for the official build from `cdn.sheetjs.com`. That host was
  blocked in the build environment, so `xlsx@0.18.5` from npm is installed for now. Switch with:
  `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (same API, no code changes).

## Publisher

- `GET|POST /api/cron/publish` (header `Authorization: Bearer <CRON_SECRET>`) publishes due posts:
  scheduled posts whose time has passed, plus failed posts waiting for an automatic retry.
- Posts are claimed atomically (`claim_due_posts`), so overlapping runs never double-publish.
  A post interrupted mid-publish is checked against Google's recent posts before it is retried.
- `auto` images are resolved at publish time (library → branded graphic / reuse).
- Failures: Google rejections and account problems fail permanently with a clear message and a
  `post_failed` notification; outages and rate limits retry after 5 and 30 minutes (3 attempts).
- Requests are spaced by `publish_spacing_seconds`; a run stops at ~50 s and leaves the rest for
  the next run. The response is `{ processed, published, failed, remaining }`.
- `GET|POST /api/cron/daily`: library stock check, rolling Google account sync, email digest.
- Triggers: `supabase/cron.sql` (pg_cron every 5 minutes + daily), the daily Vercel crons in
  `vercel.json` as a safety net, and **Run publisher now** for admins (Settings).
