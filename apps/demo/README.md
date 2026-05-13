# Hivesync Demo

This branch powers the static GitHub Pages demo for Hivesync:

https://gdsingh.github.io/hivesync/

The production app source, setup guide, database schema, API routes, and deployment docs live on the `main` branch.

## What This Branch Contains

- A static Next.js export configured for GitHub Pages
- Sample dashboard, check-in, stats, sticker, and sync history data
- The shared UI needed to render the public demo
- A GitHub Actions workflow that builds and deploys the demo from this branch

## What This Branch Does Not Contain

- Live auth flows
- API routes
- Database schema or migrations
- Google Calendar, Google Maps, or Foursquare server code
- Vercel cron or production deployment config

## Local Preview

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## GitHub Pages Build

```bash
NEXT_PUBLIC_BASE_PATH=/hivesync npm run build
```

The static output is written to `out/`. GitHub Actions deploys that folder to Pages whenever this branch is pushed.
