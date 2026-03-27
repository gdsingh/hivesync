import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth, getCalendarName } from "@/lib/sync";

export async function GET() {
  try {
    const auth = await getGoogleAuth();
    const calendarService = google.calendar({ version: "v3", auth });
    const [list, calendarName] = await Promise.all([
      calendarService.calendarList.list(),
      getCalendarName(),
    ]);
    const items = list.data.items ?? [];

    const target = items.find((c) => c.summary === calendarName);
    if (target) {
      return NextResponse.json({ status: "ready", calendarId: target.id, calendarName });
    }

    // check for the other name (user may be toggling modes)
    const other = items.find((c) => c.summary === (calendarName === "Swarm" ? "Foursquare" : "Swarm"));
    if (other) {
      return NextResponse.json({ status: "needs_rename", calendarId: other.id, calendarName });
    }

    return NextResponse.json({ status: "missing", calendarName });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
