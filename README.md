
<p align="center" style="margin: 24px 0;">
  <img src="public/hivesync.png" alt="Hivesync" width="318" height="108" />
</p>


Hivesync creates a Google Calendar event with the venue, location, friends, and any shouts after you check-in on Swarm. Runs in the background everyday, see the features list below for all it can do.

*Interested in what it looks like? Check out the [demo](https://gdsingh.github.io/hivesync/).*

### Release notes

#### v1.3.0

**New**
- Added selectable sync history rows so individual history entries can be removed without clearing everything
- Added a Google Maps enrichment toggle, with Foursquare venue locations used when enrichment is disabled
- Added clearer Foursquare fallback states to manual sync controls and the Connections module

**Bug Fixes**
- Fixed empty check-in hover cards when a check-in only had a Foursquare link
- Tightened the page number input on the Check-ins page
- Improved Google Maps preflight behavior when enrichment is disabled

**Cleanup**
- Refined Check-ins, History, and manual sync UI details from the open-issue pass
- Closed the remaining open UI issues after the mobile layout release

#### v1.2.0

- Added a mobile-friendly layout across Home, Stats, Check-ins, History, Login, and Setup screens
- Improved manual sync controls for phones, including full-width date/year pickers and clearer sync/remove spacing
- Refined the Connections panel with rounded cards, a collapsible Google Maps safety limits section, and better mobile spacing
- Improved dialogs, date pickers, pagination, footer controls, and page padding across screen sizes
- Closes issue #1

### Features

- **Connect** your Swarm and Google accounts via OAuth
- **Sync** — multiple modes to keep your calendar up to date
  - **Auto** — background polling creates calendar events daily via Vercel cron
  - **Year** — import an entire year of check-in history
  - **Date / range** — sync a single date or any date range
  - **Quick** — sync the last n check-ins on demand
- **Delete** — remove calendar events by count, year, or date range
- **No duplicates** — every synced check-in is tracked so it's never created twice
- **Dedicated calendar** — events go into a "Swarm" calendar in Google Calendar (with a bonus OG mode 😎), automatically colored to match the Swarm branding on creation.
- **Rich events** — venue name, address, shout, friends, Foursquare scores, coins, and sticker bonuses
- **Check-ins page** — browse all synced check-ins in a timeline view, filter by date, bulk remove, and click any venue to see the full event description with sticker and links
- **Stats page** — total check-ins, unique venues, top venues, categories and cities, charts by year, day, and time of day
- **Stickers page** — view all stickers you've earned from your check-ins
- **Sync history** — log of past sync runs with timestamps and counts
- **Mayor indicator** — venue name gets a 👑 crown when you were mayor at check-in time
- **Optional Google Maps enrichment** — uses Places API (New) to add a verified Google Maps location, with venue-level caching, visible limits, and Foursquare fallback controls
- **Sync count audit** — compares Swarm totals with synced calendar events year by year and flags any unaccounted check-ins

### Disclaimer ⚠️

*Designed for self-hosted, single-user deployments. Each person deploys their own instance with their own API keys. If you have any requests or bugs, you can create an issue and I'll take a look.* 

*I vibecoded this app for personal use so use at your own risk.*


## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gdsingh/hivesync)

### First-time setup

1. Click the button above to deploy — the first build skips database migrations since no vars are set yet
2. Visit your deployment URL — you'll be redirected to the setup wizard at `/setup`
3. **Step 1 — Vercel token**: create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens) with **no expiration**, paste it in, and validate
4. **Step 2 — External services**:
   - In the Vercel dashboard, go to **Storage → Create database → Neon** — this sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically. Copy `DATABASE_URL_UNPOOLED` into a new env var called `DIRECT_URL`, then paste both connection strings into the wizard
   - If you have a custom domain, enter it — this sets `NEXTAUTH_URL` and updates the callback URLs shown below
   - Create a Foursquare app at [foursquare.com/developers/apps](https://foursquare.com/developers/apps) and a Google OAuth client at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials). Copy the callback URLs shown in the wizard into each service's redirect URI settings, then paste the client IDs and secrets back into the wizard
   - Enter your Google email to lock the instance to your account
5. **Step 3 — Apply**: all env vars are written to your Vercel project and a redeploy is triggered automatically
6. After the redeploy completes, your app is ready — sign in with Google to get started

> The setup wizard self-disables once your instance is fully configured.


## Self-hosting

### Prerequisites

- Node.js 20.9+
- Postgres database (local or hosted)
- A Foursquare developer app → [foursquare.com/developers/apps](https://foursquare.com/developers/apps)
- A Google Cloud project with the Calendar API and OAuth enabled → [console.cloud.google.com](https://console.cloud.google.com)

### Local setup

```bash
git clone https://github.com/gdsingh/hivesync
cd hivesync
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your credentials, then:

```bash
npx prisma migrate deploy
npm run dev
```

Visit `http://localhost:3000`, sign in with Google, connect Foursquare, and start syncing.

## Updating

If you deployed Hivesync from a fork or copied repo, sync your repo with `gdsingh/hivesync`, then push the updated `main` branch. Vercel will redeploy from your repo automatically.

```bash
git remote add upstream https://github.com/gdsingh/hivesync.git
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

Updates stay at feature parity when the code, database migrations, and required environment variables are all current. Keep your Vercel build command running migrations before the app builds:

```bash
prisma migrate deploy && next build
```

Check the release notes and environment variable table after each update. Some features work with defaults, while others may need a new API key or setting before they turn on.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | yes | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | Your app's public URL |
| `ALLOWED_GOOGLE_EMAIL` | yes | Your Google email — locks the instance to your account, must be set before first login |
| `CRON_SECRET` | yes | Secret for the background sync endpoint — `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | yes | 32-byte key for encrypting OAuth tokens — `openssl rand -base64 32` |
| `FOURSQUARE_CLIENT_ID` | yes | From your Foursquare developer app |
| `FOURSQUARE_CLIENT_SECRET` | yes | From your Foursquare developer app |
| `GOOGLE_CLIENT_ID` | yes | From Google Cloud OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | yes | From Google Cloud OAuth credentials |
| `DATABASE_URL` | yes (prod) | Pooled Postgres connection string (set automatically by Vercel Neon) |
| `DIRECT_URL` | yes (prod) | Direct Postgres connection string — copy from `DATABASE_URL_UNPOOLED` |
| `GOOGLE_MAPS_API_KEY` | no | Enables cached Google Places enrichment for event locations |
| `GOOGLE_PLACES_DAILY_LIMIT` | no | App-level Google Places daily cap, defaults to `25` |
| `GOOGLE_PLACES_MONTHLY_LIMIT` | no | App-level Google Places monthly cap, defaults to `500` |
| `GOOGLE_PLACES_BACKFILL_RUN_LIMIT` | no | App-level Google Places cap per approved backfill, defaults to `250` |
| `GOOGLE_PLACES_WARNING_THRESHOLD` | no | Usage warning threshold, defaults to `0.8` |

### Foursquare app setup

1. Go to [foursquare.com/developers/apps](https://foursquare.com/developers/apps) and create a new app
2. Set the redirect URI to `https://your-url/api/auth/foursquare/callback`
3. Copy the client ID and secret into your env

### Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Enable the **Google Calendar API**
3. Go to **APIs & services → Credentials → Create OAuth client ID** (web application)
4. Add `https://your-url/api/auth/google/callback` as an authorized redirect URI
5. Optionally enable the **Places API (New)** and create a separate, restricted API key for Google Maps enrichment

### Google Maps enrichment and cost controls

Google Maps enrichment is optional. If `GOOGLE_MAPS_API_KEY` is not set, Hivesync uses Foursquare venue location data for calendar events.

When enabled, Hivesync uses **Places API (New)** `places:searchText` with a narrow field mask: `places.id`, `places.formattedAddress`, and `places.googleMapsUri`. It does not request Contact Data or Atmosphere Data fields.

To reduce duplicate calls, Hivesync stores one Google mapping per Foursquare venue. Repeated check-ins at the same venue use the cached mapping and do not make another Google Places call. The connections dialog shows daily/monthly usage, lifetime calls, cache count, mapped venues, cache hits, and lookup results.

Hivesync also has app-level caps before it calls Google:

- Daily cap: `GOOGLE_PLACES_DAILY_LIMIT`, default `25`
- Monthly cap: `GOOGLE_PLACES_MONTHLY_LIMIT`, default `500`
- Manual backfill run cap: `GOOGLE_PLACES_BACKFILL_RUN_LIMIT`, default `250`
- Warning threshold: `GOOGLE_PLACES_WARNING_THRESHOLD`, default `0.8`

For manual year/date backfills, the app shows a preflight estimate before syncing: uncached venues, estimated Google Maps lookups, remaining allowance, and fallback count. You can set a per-run Google Maps API limit and choose whether to use Foursquare data after the limit is reached.

These app limits are guardrails, not a replacement for Google Cloud controls. Restrict your API key, keep only the APIs you use enabled, set Google Cloud quotas, and add a billing budget/alert in Google Cloud.

## Database

**Postgres is required for production.** The easiest option is Neon Postgres via the Vercel dashboard (Storage → Create database → Neon).

Vercel's Neon integration provides two connection strings:
- `DATABASE_URL` — pooled connection via pgbouncer, used by the app at runtime
- `DATABASE_URL_UNPOOLED` — direct connection, required for running migrations

Copy `DATABASE_URL_UNPOOLED` into a new env var named `DIRECT_URL`. Without this, `prisma migrate deploy` will fail on the pooled connection.

For local development:

```bash
docker run -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=hivesync postgres
```

Then set `DATABASE_URL=postgresql://postgres:password@localhost:5432/hivesync`.


## Background sync

Hivesync automatically polls for new check-ins once per day using Vercel's built-in cron (free tier). The cron job is defined in `vercel.json` and runs at 09:00 UTC — no setup needed once deployed. The "last synced" indicator on the home page reflects both individual check-in syncs and cron job completions.

**Want more frequent sync?** Set up a free job on [cron-job.org](https://cron-job.org) pointing at:
- URL: `POST https://your-app.vercel.app/api/sync/poll`
- Header: `Authorization: Bearer <your CRON_SECRET>`
- Schedule: every 5 minutes


## Manual sync options

The home page provides three sync modes, each with sync and remove actions:

- **Last n** — sync or remove the most recent n check-ins (max 250)
- **Date / range** — pick a single date or a date range to sync or remove check-ins within that window
- **Year** — sync or remove all check-ins from a specific year; shows Foursquare count vs synced count with a visual sync progress bar

The year picker covers `2009` through the current year. As you check years, Hivesync saves a count audit comparing Swarm totals against synced calendar events. If every available year has been checked and a gap remains, the home page shows an `unaccounted check-ins` warning with a hover explanation.

### Historical backfill

To import your full check-in history, use the yearly sync mode one year at a time rather than attempting everything at once. Each sync requires per-check-in detail calls to Foursquare, so large backlogs take time — a single year typically takes 3–6 minutes. Doing it year by year lets you take breaks, catch any errors early, and avoid keeping a browser tab open for hours. The daily cron handles all new check-ins going forward, so the backfill is a one-time task.

If Google Maps enrichment is enabled, backfills can also use Google Places calls for venues that are not already cached. Before a year or range sync starts, Hivesync estimates the uncached venues and asks for confirmation when the estimate exceeds the normal daily cap. For safer testing, set a low **Google Maps API limit** for the manual run. If **Use Foursquare Data** is enabled, Hivesync continues creating calendar events with Foursquare locations after the limit is reached; otherwise the sync stops at the limit.

## Check-ins page

Browse all synced check-ins at `/checkins` — a dot-style timeline grouped by day. Features:

- **Date filter** — pick a single date or range to narrow results
- **Bulk remove** — select individual rows or entire days, then remove from the floating action bar
- **Bulk resync** — re-fetches selected check-ins from Foursquare and recreates their calendar events (useful after event format changes)
- **Venue popover** — click any venue name to see the full event description, earned sticker, and links to Foursquare and Google Calendar

## Sync history

Every sync run is logged at `/history` — a timeline of past syncs with type, counts, and timestamps. Covers scheduled syncs, manual syncs, date range and yearly syncs, deletes, and manual resyncs. The log can be cleared at any time without affecting synced check-ins.

## Event format

Each calendar event looks like this:

- **Title**: venue name (with 👑 if you were mayor)
- **Location**: Google formatted address when enrichment is available; otherwise Foursquare venue location
- **Duration**: 15 minutes from check-in time, in the venue's local timezone
- **Description**:

  ```
  💬 your shout here
  • Foursquare score message (+5)
  💰 120 coins · 🎫 3X Baggs sticker bonus!
  👥 with friend name
  ❤️ liked by friend name
  https://foursquare.com/v/<venue-id>
  ```

## Static demo

The public demo is maintained in `apps/demo` and deployed to GitHub Pages:

https://gdsingh.github.io/hivesync/

The demo is a static Next.js export with sample data only. It does not include auth, API routes, database access, cron, or live Google/Foursquare calls. Vercel ignores `apps/demo` via `.vercelignore`, so deploying the main app from this repo only deploys the production app.

## Stack

- [Next.js 16](https://nextjs.org) (app router, TypeScript)
- [shadcn/ui](https://ui.shadcn.com) + [Geist](https://www.npmjs.com/package/geist) font
- [Prisma](https://prisma.io) + Neon Postgres
- [googleapis](https://www.npmjs.com/package/googleapis) — Google Calendar API
- [geo-tz](https://www.npmjs.com/package/geo-tz) — local timezone lookup from lat/lng

## License

MIT
