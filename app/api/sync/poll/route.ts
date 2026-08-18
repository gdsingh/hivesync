import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { safeCompare } from "@/lib/session";
import { decrypt } from "@/lib/encrypt";
import {
  getGoogleAuth,
  ensureSwarmCalendar,
  fetchCheckins,
  syncCheckins,
  type FoursquareCheckin,
} from "@/lib/sync";

const DAILY_LOOKBACK_DAYS = 1;
const WEEKLY_BACKFILL_DAYS = 30;
const FETCH_PAGE_SIZE = 250;

async function fetchLookbackCheckins(token: string, afterTimestamp: number) {
  const checkins: FoursquareCheckin[] = [];
  let offset = 0;

  while (true) {
    const { items, total } = await fetchCheckins(
      token,
      offset,
      afterTimestamp,
      FETCH_PAGE_SIZE
    );

    checkins.push(...items.filter((checkin) => checkin.createdAt >= afterTimestamp));
    offset += FETCH_PAGE_SIZE;

    if (offset >= total || items.length < FETCH_PAGE_SIZE) break;
  }

  return checkins;
}

async function handlePoll(req: NextRequest) {
  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);
  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const isWeeklyBackfill = req.nextUrl.searchParams.get("backfill") === "weekly";
  const lookbackDays = isWeeklyBackfill ? WEEKLY_BACKFILL_DAYS : DAILY_LOOKBACK_DAYS;
  const afterTimestamp = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000);
  const items = await fetchLookbackCheckins(foursquareToken, afterTimestamp);
  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken, {
    googleMapsEnabled: userConfig.googleMapsEnabled,
  });

  await db.syncLog.create({
    data: {
      type: "POLL",
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      ...(isWeeklyBackfill
        ? {
            fromDate: new Date(afterTimestamp * 1000).toISOString().slice(0, 10),
            toDate: new Date().toISOString().slice(0, 10),
          }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, lookbackDays, checked: items.length, ...result });
}

function authorizePoll(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return safeCompare(authHeader, `Bearer ${cronSecret}`);
}

// GET — vercel cron
export async function GET(req: NextRequest) {
  if (!authorizePoll(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handlePoll(req);
}

// POST — cron-job.org
export async function POST(req: NextRequest) {
  if (!authorizePoll(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handlePoll(req);
}
