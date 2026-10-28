# OrbitPost by Rank Orbit

Google Business Profile posting platform for Rank Orbit LLC: connect Gmail accounts, sync
Business Profiles, compose or bulk-import posts, approve them, and publish on schedule through
the official Google Business Profile APIs only (no browser automation or scraping).

**Contents:** [Setup](#setup) · [First-run checklist](#first-run-checklist) ·
[Local development](#local-development) · [Troubleshooting](#troubleshooting) ·
[How it works](#how-it-works)

---

# Setup

Do these in order. Keep a text file open and paste each value as you collect it; they all go into
Vercel in step 6.

## 1. Supabase (database + image storage)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/migrations/001_init.sql` and click **Run**.
   It creates every table and the public storage bucket `post-media`.
3. **Storage**: confirm the bucket `post-media` exists and is **Public** (Google downloads post
   images from its public URLs).
4. **Project Settings → API**: copy the **Project URL** → `SUPABASE_URL` and the
   **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is a server secret.
5. `supabase/cron.sql` is run later, in step 7, after the app is deployed.

## 2. Clerk (team login)

1. Create an application at [clerk.com](https://clerk.com); enable Email (and Google if you like).
2. **Configure → Restrictions → Sign-up mode → Restricted**, so only invited people can join.
3. **API Keys**: copy the Publishable key → `VITE_CLERK_PUBLISHABLE_KEY` and the Secret key →
   `CLERK_SECRET_KEY`.
4. Invite your team from **Users → Invite**. The first person to sign in becomes `admin`; everyone
   after that starts as `writer`. Admins change roles on the **Settings** page.

## 3. Google Cloud (the project whose Business Profile API access is approved)

1. **APIs & Services → Library**: make sure these are enabled:
   Google My Business API, My Business Account Management API, My Business Business Information API.
2. **APIs & Services → Credentials →** your OAuth **Web application** client →
   **Authorized redirect URIs**, add:
   - `https://<your-project>.vercel.app/api/google/callback`
   - `http://localhost:5173/api/google/callback` (local development only)
3. Copy the **Client ID** → `GOOGLE_CLIENT_ID` and **Client secret** → `GOOGLE_CLIENT_SECRET`.
4. **OAuth consent screen**: scopes `openid`, `email`, `profile`,
   `https://www.googleapis.com/auth/business.manage`. While the app is in *Testing*, add every
   Gmail you will connect as a test user.

## 4. Gemini

Create an API key at [aistudio.google.com](https://aistudio.google.com) → `GEMINI_API_KEY`.
Leave `GEMINI_MODEL` empty to use `gemini-flash-latest` (always the current Flash model).

## 5. Secrets and optional email

Generate each secret once (any terminal with OpenSSL):

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY (must be exactly 32 bytes, base64)
openssl rand -hex 32      # OAUTH_STATE_SECRET
openssl rand -hex 32      # CRON_SECRET
```

Never change `TOKEN_ENCRYPTION_KEY` after connecting Gmails; stored Google tokens become
unreadable and every account must be reconnected.

Optional email alerts via [Resend](https://resend.com): verify your sending domain, create an API
key, then set `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` (e.g. `OrbitPost <alerts@yourdomain.com>`)
and `NOTIFY_TO_EMAILS` (comma-separated). Leave them empty for in-app alerts only.

## 6. Vercel (hosting)

1. **Add New → Project →** import this GitHub repository. Vercel detects Vite; keep the defaults
   (build `npm run build`, output `dist`).
2. **Settings → Environment Variables**: add every variable from `.env.example`:

   | Variable | Value |
   | --- | --- |
   | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Step 2 |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Step 1 |
   | `SUPABASE_STORAGE_BUCKET` | `post-media` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Step 3 |
   | `GOOGLE_REDIRECT_URI` | `https://<your-project>.vercel.app/api/google/callback` |
   | `TOKEN_ENCRYPTION_KEY`, `OAUTH_STATE_SECRET`, `CRON_SECRET` | Step 5 |
   | `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) | Step 4 |
   | `APP_URL` | `https://<your-project>.vercel.app` (no trailing slash) |
   | `DEFAULT_TIMEZONE` | `Asia/Karachi` (or your default) |
   | `IMAGE_LOW_STOCK_THRESHOLD` | `5` |
   | `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_TO_EMAILS` | Step 5 (optional) |

3. **Deploy.** Production deploys from the default branch (`main`).
4. Open `https://<your-project>.vercel.app/api/health`. Every entry under `config` you use should
   be `true`, and `database` should be `true`. A `false` means that variable is missing or wrong;
   fix it and redeploy.
5. Changed a variable later? **Deployments → … → Redeploy** so the function picks it up.

## 7. Turn on automatic publishing

Vercel Hobby cron jobs can only run once a day, so Supabase triggers the publisher every 5 minutes.

1. Open `supabase/cron.sql` and replace **every** `https://YOUR-APP.vercel.app` with your
   `APP_URL` and **every** `YOUR_CRON_SECRET` with your `CRON_SECRET`.
2. Paste it into the Supabase **SQL Editor** and **Run**.
3. After ~5 minutes, run this in the SQL Editor:
   ```sql
   select status_code, created, left(content::text, 200) from net._http_response order by created desc limit 5;
   ```
   `200` with `{"processed":…}` means it works. `401` = wrong secret, `404` = wrong URL.
4. Safety nets: `vercel.json` also calls the publisher and the daily maintenance once a day, and
   admins can press **Settings → Run publisher now** at any time.

# First-run checklist

1. Sign in (you become admin) and invite the team in Clerk.
2. **Connections → Connect Google Account** for each Gmail. Each sync starts automatically.
3. **Locations**: check time zones, deactivate profiles you do not manage, set a default Gmail
   where several Gmails manage the same business.
4. **Clients**: rename or merge the auto-created clients; add brand voice and default link.
   Mark clients you no longer serve as inactive.
5. **Library → each client → Brand kit**: logo, colours, tagline, preferred templates.
6. **Library → Upload images** for each client (files or a ZIP).
7. **Settings**: approval on/off, posts per run, spacing.
8. **Import → Download template**, fill it in, upload, review, commit.
9. Approve the posts (if approval is on) and watch them publish on the **Calendar** / **Queue**.

# Local development

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`, then run the API and the web app in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

Open http://localhost:5173 (Vite proxies `/api` to the API on port 3001). Alternatively run
`vercel dev` to use the real serverless function. For Google sign-in locally, set
`GOOGLE_REDIRECT_URI=http://localhost:5173/api/google/callback` and `APP_URL=http://localhost:5173`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Local Hono API server (reads `.env.local` / `.env`) |
| `npm run typecheck` | Type-checks the client, server and config projects |
| `npm run build` | Production build of the SPA into `dist/` |

# Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| `redirect_uri_mismatch` when connecting | The redirect URI in Google Cloud must match `GOOGLE_REDIRECT_URI` exactly (https, domain, `/api/google/callback`, no trailing slash). |
| Connection shows **Needs reconnect** / `invalid_grant` | The Gmail's access expired or was revoked (password change, removed access, Testing-mode 7-day tokens). Click **Reconnect**. Publish the consent screen to avoid weekly expiry. |
| Google error 429 / quota | Too many requests. Lower **Max posts per run** or raise **Seconds between posts** in Settings; failed posts retry automatically. |
| Account syncs with 0 locations | Google returns `{}` when the account has no locations; check the Gmail really manages those profiles in business.google.com. |
| Post failed: image rejected | Google must download the image: the `post-media` bucket must be public, and images must be JPG/PNG (OrbitPost converts uploads automatically). |
| Post failed: "Phone numbers are not allowed" | Google rejects phone numbers, links and emails in post text; edit the text and **Retry now**. |
| Import row "Business not found under this Gmail" | That Gmail cannot manage the business. The message names the Gmail that can; change the `gmail` column or sync the account. |
| Import row "needs review" | Several locations match the name; pick one in the preview or add a `city` column. |
| Branded graphics fail / font errors on Vercel | `vercel.json` must keep `"includeFiles": "server/assets/**"` so the fonts deploy with the function. |
| `/api/health` shows `server_misconfigured` | A required environment variable is missing; the error message names it. |
| Publisher never runs | Check step 7: `net._http_response` should show 200s every 5 minutes. |

# How it works

> Status: all phases (1–11) are implemented. One known deviation: SheetJS comes from npm
> (`xlsx@0.18.5`) because `cdn.sheetjs.com` was blocked in the build environment; see
> [Spreadsheet import](#spreadsheet-import) for the one-line switch to the official build.

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
