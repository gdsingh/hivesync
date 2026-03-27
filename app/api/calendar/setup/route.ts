import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth, getCalendarName } from "@/lib/sync";

export async function POST() {
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
      return NextResponse.json({ ok: true, action: "exists", calendarId: target.id });
    }

    // rename the other variant if it exists (handles dev suffix e.g. "Swarm (dev)" ↔ "Foursquare (dev)")
    const suffix = calendarName.slice(calendarName.startsWith("Swarm") ? "Swarm".length : "Foursquare".length);
    const otherBase = calendarName.startsWith("Swarm") ? "Foursquare" : "Swarm";
    const other = items.find((c) => c.summary === `${otherBase}${suffix}`);
    if (other?.id) {
      await calendarService.calendars.patch({
        calendarId: other.id,
        requestBody: { summary: calendarName },
      });
      return NextResponse.json({ ok: true, action: "renamed", calendarId: other.id });
    }

    // create fresh
    const created = await calendarService.calendars.insert({
      requestBody: { summary: calendarName, description: "🐝 syncs your swarm check-ins to google calendar (via hivesync)" },
    });
    if (created.data.id) {
      await calendarService.calendarList.patch({
        calendarId: created.data.id,
        colorRgbFormat: true,
        requestBody: { backgroundColor: "#1C2729", foregroundColor: "#ffffff" },
      });
    }
    return NextResponse.json({ ok: true, action: "created", calendarId: created.data.id });
  } catch {
    return NextResponse.json({ ok: false, error: "failed to set up calendar" }, { status: 500 });
  }
}
