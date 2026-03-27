import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";

  const now = Math.floor(Date.now() / 1000);
  let afterTs: number | undefined;
  let beforeTs: number | undefined;

  if (period === "week") {
    afterTs = now - 7 * 24 * 3600;
  } else if (period === "30d") {
    afterTs = now - 30 * 24 * 3600;
  } else if (period === "90d") {
    afterTs = now - 90 * 24 * 3600;
  } else if (period === "year" || /^\d{4}$/.test(period)) {
    const y = period === "year" ? new Date().getFullYear() : parseInt(period);
    afterTs = Math.floor(new Date(y, 0, 1).getTime() / 1000);
    beforeTs = Math.floor(new Date(y + 1, 0, 1).getTime() / 1000);
  }

  const tsFilter = afterTs
    ? beforeTs ? { gte: afterTs, lt: beforeTs } : { gte: afterTs }
    : undefined;

  const rows = await db.syncedCheckin.findMany({
    where: { checkinTimestamp: { not: null }, ...(tsFilter ? { checkinTimestamp: tsFilter } : {}) },
    select: { checkinTimestamp: true },
  });

  const hourMap = new Map<number, number>();
  for (let i = 0; i < 24; i++) hourMap.set(i, 0);
  for (const row of rows) {
    if (row.checkinTimestamp == null) continue;
    const hour = new Date(row.checkinTimestamp * 1000).getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }

  const byHour = Array.from(hourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  return NextResponse.json(byHour);
}
