import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  if (!after || !before) {
    return NextResponse.json({ error: "after and before required" }, { status: 400 });
  }

  const count = await db.syncedCheckin.count({
    where: {
      checkinTimestamp: {
        gte: parseInt(after),
        lte: parseInt(before),
      },
    },
  });

  return NextResponse.json({ count });
}
