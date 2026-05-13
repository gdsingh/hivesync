import { NextRequest, NextResponse } from "next/server";
import { getSyncCountAudit, updateSyncCountAudit } from "@/lib/sync-count-audit";

export async function GET() {
  try {
    return NextResponse.json({ audit: await getSyncCountAudit() });
  } catch {
    return NextResponse.json({ error: "could not load sync count audit" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const year = Number(body.year);
    const foursquare = Number(body.foursquare);
    const synced = Number(body.synced);
    const totalCheckins = body.totalCheckins == null ? null : Number(body.totalCheckins);

    if (![year, foursquare, synced].every(Number.isFinite)) {
      return NextResponse.json({ error: "valid year, foursquare, and synced counts required" }, { status: 400 });
    }

    const audit = await updateSyncCountAudit({
      year,
      foursquare,
      synced,
      totalCheckins: Number.isFinite(totalCheckins) ? totalCheckins : null,
    });
    return NextResponse.json({ audit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not update sync count audit";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
