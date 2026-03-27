import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { getGoogleAuth, getCalendarName } from "@/lib/sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { from, to } = body as { from?: string; to?: string };

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const fromParsed = new Date(from);
  const toParsed = new Date(to);
  if (isNaN(fromParsed.getTime()) || isNaN(toParsed.getTime())) {
    return NextResponse.json({ error: "invalid date format" }, { status: 400 });
  }

  const fromTs = Math.floor(fromParsed.getTime() / 1000);
  const toDate = toParsed;
  toDate.setHours(23, 59, 59, 999);
  const toTs = Math.floor(toDate.getTime() / 1000);

  const checkins = await db.syncedCheckin.findMany({
    where: {
      checkinTimestamp: { gte: fromTs, lte: toTs },
    },
  });

  if (checkins.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, errors: 0 });
  }

  let errors = 0;

  let calendarId: string | undefined;
  let calendarService: ReturnType<typeof google.calendar> | undefined;

  try {
    const auth = await getGoogleAuth();
    calendarService = google.calendar({ version: "v3", auth });
    const [list, calendarName] = await Promise.all([
      calendarService.calendarList.list(),
      getCalendarName(),
    ]);
    calendarId = list.data.items?.find((c) => c.summary === calendarName)?.id ?? undefined;
  } catch {
    // if google auth fails, still clean up db records
  }

  for (const checkin of checkins) {
    if (calendarService && calendarId) {
      try {
        await calendarService.events.delete({
          calendarId,
          eventId: checkin.calendarEventId,
        });
      } catch (err: unknown) {
        const status = (err as { code?: number })?.code;
        if (status !== 404 && status !== 410) {
          errors++;
          continue;
        }
      }
    }

    await db.syncedCheckin.delete({ where: { checkinId: checkin.checkinId } });
  }

  return NextResponse.json({
    ok: true,
    deleted: checkins.length - errors,
    errors,
  });
}
