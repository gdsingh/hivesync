import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import {
  getGoogleAuth,
  ensureSwarmCalendar,
  fetchCheckinDetail,
  syncCheckins,
} from "@/lib/sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "provide ids" }, { status: 400 });
  }

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);

  let calendarService: ReturnType<typeof google.calendar>;
  let calendarId: string;
  try {
    const auth = await getGoogleAuth();
    calendarService = google.calendar({ version: "v3", auth });
    calendarId = await ensureSwarmCalendar(calendarService);
  } catch {
    return NextResponse.json({ error: "google not connected" }, { status: 400 });
  }

  // delete existing calendar events + db records
  const existing = await db.syncedCheckin.findMany({
    where: { checkinId: { in: ids } },
    select: { checkinId: true, calendarEventId: true },
  });

  for (const checkin of existing) {
    try {
      await calendarService.events.delete({ calendarId, eventId: checkin.calendarEventId });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 404 && code !== 410) { /* ignore */ }
    }
    await db.syncedCheckin.delete({ where: { checkinId: checkin.checkinId } }).catch(() => {});
  }

  // fetch full details from foursquare and re-sync
  const checkinDetails = await Promise.all(
    ids.map((id) => fetchCheckinDetail(foursquareToken, id).catch(() => null))
  );
  const valid = checkinDetails.filter(Boolean) as Awaited<ReturnType<typeof fetchCheckinDetail>>[];

  const result = await syncCheckins(valid, calendarService, calendarId, foursquareToken);

  await db.syncLog.create({
    data: { type: "RESYNC", synced: result.synced, skipped: result.skipped, errors: result.errors, errorMessage: `${ids.length} selected` },
  });

  return NextResponse.json({ ok: true, ...result });
}
