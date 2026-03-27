import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import {
  getGoogleAuth,
  ensureSwarmCalendar,
  fetchCheckins,
  syncCheckins,
} from "@/lib/sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count: number = Math.min(body.count ?? 50, 250);

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);
  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const { items } = await fetchCheckins(foursquareToken, 0, undefined, count);
  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken);

  await db.syncLog.create({
    data: { type: "QUICK", synced: result.synced, skipped: result.skipped, errors: result.errors },
  });

  return NextResponse.json({ ok: true, ...result });
}
