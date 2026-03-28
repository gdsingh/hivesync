
<p align="center" style="margin: 24px 0;">
  <img src="public/hivesync.png" alt="Hivesync" width="318" height="108" />
</p>


Hivesync creates a Google Calendar event with the venue, location, friends, and any shouts after you check-in on Swarm. Runs in the background everyday, see the features list below for all it can do.

*Interested in what it looks like, check out the [demo](https://hivesync.vercel.app).*

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
- **Optional Google Maps enrichment** — adds a verified address and maps link if you provide a Google Maps API key

### Disclaimer ⚠️

*Designed for self-hosted, single-user deployments. Each person deploys their own instance with their own API keys.* 

*I vibe-cdoded this app for myself so use at your own risk. If you have any requests or bugs, feel free to create an issue.*


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
| `GOOGLE_MAPS_API_KEY` | no | Enables enriched addresses and Google Maps links on events |

### Foursquare app setup

1. Go to [foursquare.com/developers/apps](https://foursquare.com/developers/apps) and create a new app
2. Set the redirect URI to `https://your-url/api/auth/foursquare/callback`
3. Copy the client ID and secret into your env

### Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Enable the **Google Calendar API**
3. Go to **APIs & services → Credentials → Create OAuth client ID** (web application)
4. Add `https://your-url/api/auth/google/callback` as an authorized redirect URI
5. Optionally enable the **Places API** and create a separate API key for Google Maps enrichment

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

Hivesync automatically polls for new check-ins once per day using Vercel's built-in cron (free tier). The cron job is defined in `vercel.json` and runs at midnight UTC — no setup needed once deployed. The "last synced" indicator on the home page reflects both individual check-in syncs and cron job completions.

**Want more frequent sync?** Set up a free job on [cron-job.org](https://cron-job.org) pointing at:
- URL: `POST https://your-app.vercel.app/api/sync/poll`
- Header: `Authorization: Bearer <your CRON_SECRET>`
- Schedule: every 5 minutes


## Manual sync options

The home page provides three sync modes, each with sync and remove actions:

- **Last n** — sync or remove the most recent n check-ins (max 250)
- **Date / range** — pick a single date or a date range to sync or remove check-ins within that window
- **Year** — sync or remove all check-ins from a specific year; shows Foursquare count vs synced count with a visual sync progress bar

### Historical backfill

To import your full check-in history, use the yearly sync mode one year at a time rather than attempting everything at once. Each sync requires a per-check-in detail call to Foursquare, so large backlogs take time — a single year typically takes 3–6 minutes. Doing it year by year lets you take breaks, catch any errors early, and avoid keeping a browser tab open for hours. The daily cron handles all new check-ins going forward, so the backfill is a one-time task.

## Check-ins page

Browse all synced check-ins at `/checkins` — a dot-style timeline grouped by day. Features:

- **Date filter** — pick a single date or range to narrow results
- **Bulk remove** — select individual rows or entire days, then remove from the floating action bar
- **Bulk resync** — re-fetches selected check-ins from Foursquare and recreates their calendar events (useful after event format changes)
- **Venue popover** — click any venue name to see the full event description, earned sticker, and links to Foursquare and Google Calendar

## Sync history

Every sync run is logged at `/history` — a timeline of past syncs with type, counts, and timestamps. Covers auto-syncs, manual syncs, date range and yearly syncs, deletes, and manual resyncs. The log can be cleared at any time without affecting synced check-ins.

## Event format

Each calendar event looks like this:

- **Title**: venue name (with 👑 if you were mayor)
- **Location**: full address (+ Google Maps link if maps key is set)
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

## Stack

- [Next.js 16](https://nextjs.org) (app router, TypeScript)
- [shadcn/ui](https://ui.shadcn.com) + [Geist](https://www.npmjs.com/package/geist) font
- [Prisma](https://prisma.io) + Neon Postgres
- [googleapis](https://www.npmjs.com/package/googleapis) — Google Calendar API
- [geo-tz](https://www.npmjs.com/package/geo-tz) — local timezone lookup from lat/lng

## License

MIT
