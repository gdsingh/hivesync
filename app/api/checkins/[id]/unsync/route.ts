import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function PATCH(
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

  // remove the db record only — leaves the calendar event intact
  await db.syncedCheckin.delete({ where: { checkinId: id } });

  return NextResponse.json({ ok: true });
}
