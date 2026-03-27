import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";

  const now = Math.floor(Date.now() / 1000);
  let afterTs: number | undefined;
  let beforeTs: number | undefined;
  let durationWeeks: number;

  if (period === "week") {
    afterTs = now - 7 * 24 * 3600;
    durationWeeks = 1;
  } else if (period === "30d") {
    afterTs = now - 30 * 24 * 3600;
    durationWeeks = 30 / 7;
  } else if (period === "90d") {
    afterTs = now - 90 * 24 * 3600;
    durationWeeks = 90 / 7;
  } else if (period === "year" || /^\d{4}$/.test(period)) {
    const y = period === "year" ? new Date().getFullYear() : parseInt(period);
    afterTs = Math.floor(new Date(y, 0, 1).getTime() / 1000);
    beforeTs = Math.floor(new Date(y + 1, 0, 1).getTime() / 1000);
    durationWeeks = (beforeTs - afterTs) / (7 * 24 * 3600);
  } else {
    afterTs = 0;
    durationWeeks = 1;
  }

  const tsFilter = afterTs
    ? beforeTs ? { gte: afterTs, lt: beforeTs } : { gte: afterTs }
    : undefined;

  const where = tsFilter ? { checkinTimestamp: tsFilter } : {};

  const [total, mayorships] = await Promise.all([
    db.syncedCheckin.count({ where }),
    db.syncedCheckin.count({ where: { ...where, isMayor: true } }),
  ]);

  const avgPerWeek = durationWeeks > 0 ? Math.round((total / durationWeeks) * 10) / 10 : 0;

  return NextResponse.json({ total, avgPerWeek, mayorships });
}
