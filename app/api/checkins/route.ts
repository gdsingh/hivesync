import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.min(10000, Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1));

  const where: {
    checkinTimestamp?: { gte?: number; lte?: number };
  } = {};

  if (from || to) {
    where.checkinTimestamp = {};
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: "invalid from date" }, { status: 400 });
      }
      where.checkinTimestamp.gte = Math.floor(fromDate.getTime() / 1000);
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "invalid to date" }, { status: 400 });
      }
      toDate.setHours(23, 59, 59, 999);
      where.checkinTimestamp.lte = Math.floor(toDate.getTime() / 1000);
    }
  }

  const [checkins, total] = await Promise.all([
    db.syncedCheckin.findMany({
      where,
      orderBy: { checkinTimestamp: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.syncedCheckin.count({ where }),
  ]);

  return NextResponse.json({ checkins, total, page, pageSize: PAGE_SIZE });
}
