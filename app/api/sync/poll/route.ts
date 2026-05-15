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
} from "@/lib/sync";

async function handlePoll() {
  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);
  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  // fetch check-ins from the last 24 hours
  const afterTimestamp = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const { items } = await fetchCheckins(foursquareToken, 0, afterTimestamp, 20);
  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken, {
    googleMapsEnabled: userConfig.googleMapsEnabled,
  });

  await db.syncLog.create({
    data: { type: "POLL", synced: result.synced, skipped: result.skipped, errors: result.errors },
  });

  return NextResponse.json({ ok: true, ...result });
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
  return handlePoll();
}

// POST — cron-job.org
export async function POST(req: NextRequest) {
  if (!authorizePoll(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handlePoll();
}
