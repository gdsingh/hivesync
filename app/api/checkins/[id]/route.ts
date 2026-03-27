import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { getGoogleAuth, getCalendarName } from "@/lib/sync";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkin = await db.syncedCheckin.findUnique({
    where: { checkinId: id },
  });

  if (!checkin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // delete the google calendar event
  try {
    const auth = await getGoogleAuth();
    const calendarService = google.calendar({ version: "v3", auth });

    // find the sync calendar id
    const [list, calendarName] = await Promise.all([
      calendarService.calendarList.list(),
      getCalendarName(),
    ]);
    const calendar = list.data.items?.find((c) => c.summary === calendarName);

    if (calendar?.id) {
      await calendarService.events.delete({
        calendarId: calendar.id,
        eventId: checkin.calendarEventId,
      });
    }
  } catch (err: unknown) {
    // 404/410 = event already gone — treat as success
    const status = (err as { code?: number })?.code;
    if (status !== 404 && status !== 410) {
      console.error("failed to delete calendar event:", err);
      return NextResponse.json({ error: "calendar delete failed" }, { status: 500 });
    }
  }

  await db.syncedCheckin.delete({ where: { checkinId: id } });

  return NextResponse.json({ ok: true });
}
