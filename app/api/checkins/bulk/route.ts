import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { getGoogleAuth, getCalendarName } from "@/lib/sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // resolve records — explicit ids, last N, year, or all
  let checkins: { checkinId: string; calendarEventId: string }[];

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    checkins = await db.syncedCheckin.findMany({
      where: { checkinId: { in: body.ids } },
      select: { checkinId: true, calendarEventId: true },
    });
  } else if (typeof body.count === "number" && body.count > 0) {
    checkins = await db.syncedCheckin.findMany({
      orderBy: { syncedAt: "desc" },
      take: body.count,
      select: { checkinId: true, calendarEventId: true },
    });
  } else if (typeof body.year === "number") {
    const from = Math.floor(new Date(body.year, 0, 1).getTime() / 1000);
    const to = Math.floor(new Date(body.year + 1, 0, 1).getTime() / 1000);
    checkins = await db.syncedCheckin.findMany({
      where: { checkinTimestamp: { gte: from, lt: to } },
      select: { checkinId: true, calendarEventId: true },
    });
  } else if (body.all === true) {
    checkins = await db.syncedCheckin.findMany({
      select: { checkinId: true, calendarEventId: true },
    });
  } else {
    return NextResponse.json({ error: "provide ids, count, year, or all:true" }, { status: 400 });
  }

  if (checkins.length === 0) return NextResponse.json({ deleted: 0, errors: 0 });

  let calendarId: string | null = null;
  let calendarService: ReturnType<typeof google.calendar> | null = null;

  try {
    const auth = await getGoogleAuth();
    calendarService = google.calendar({ version: "v3", auth });
    const calName = await getCalendarName();
    const list = await calendarService.calendarList.list();
    calendarId = list.data.items?.find((c) => c.summary === calName)?.id ?? null;
  } catch {
    return NextResponse.json({ error: "google auth failed" }, { status: 500 });
  }

  let deleted = 0;
  let errors = 0;

  for (const checkin of checkins) {
    try {
      if (calendarService && calendarId) {
        try {
          await calendarService.events.delete({
            calendarId,
            eventId: checkin.calendarEventId,
          });
        } catch (err: unknown) {
          const status = (err as { code?: number })?.code;
          if (status !== 404 && status !== 410) throw err;
        }
      }
      await db.syncedCheckin.delete({ where: { checkinId: checkin.checkinId } });
      deleted++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ deleted, errors });
}
