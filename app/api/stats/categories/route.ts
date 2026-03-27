import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";

  if (period === "all") {
    const rows = await db.syncedCheckin.groupBy({
      by: ["venueCategory"],
      where: { venueCategory: { not: null } },
      _count: { checkinId: true },
      orderBy: { _count: { checkinId: "desc" } },
      take: 5,
    });
    return NextResponse.json(rows.map((r) => ({ category: r.venueCategory!, count: r._count.checkinId })));
  }

  const now = Math.floor(Date.now() / 1000);
  let afterTs: number;
  let beforeTs: number | undefined;

  if (period === "week") {
    afterTs = now - 7 * 24 * 60 * 60;
  } else if (period === "30d") {
    afterTs = now - 30 * 24 * 60 * 60;
  } else if (period === "90d") {
    afterTs = now - 90 * 24 * 60 * 60;
  } else if (period === "year" || /^\d{4}$/.test(period)) {
    const y = period === "year" ? new Date().getFullYear() : parseInt(period);
    afterTs = Math.floor(new Date(y, 0, 1).getTime() / 1000);
    beforeTs = Math.floor(new Date(y + 1, 0, 1).getTime() / 1000);
  } else {
    afterTs = 0;
  }

  const tsFilter = beforeTs
    ? { gte: afterTs, lt: beforeTs }
    : { gte: afterTs };

  const rows = await db.syncedCheckin.groupBy({
    by: ["venueCategory"],
    where: { venueCategory: { not: null }, checkinTimestamp: tsFilter },
    _count: { checkinId: true },
    orderBy: { _count: { checkinId: "desc" } },
    take: 5,
  });

  return NextResponse.json(rows.map((r) => ({ category: r.venueCategory!, count: r._count.checkinId })));
}
