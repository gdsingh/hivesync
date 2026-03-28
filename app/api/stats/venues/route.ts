import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let tsFilter: { gte: number; lt?: number } | undefined;

  if (from && to) {
    tsFilter = {
      gte: Math.floor(new Date(from).getTime() / 1000),
      lt: Math.floor(new Date(to + "T23:59:59").getTime() / 1000),
    };
  } else if (period !== "all") {
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

    tsFilter = beforeTs ? { gte: afterTs, lt: beforeTs } : { gte: afterTs };
  }

  const rows = await db.syncedCheckin.groupBy({
    by: ["venueId", "venueName"],
    where: { venueId: { not: null }, ...(tsFilter ? { checkinTimestamp: tsFilter } : {}) },
    _count: { checkinId: true },
    orderBy: { _count: { checkinId: "desc" } },
    take: 10,
  });

  return NextResponse.json(rows.map((v) => ({ venueId: v.venueId, venueName: v.venueName, count: v._count.checkinId })));
}
