import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";

const LIMIT = 250;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  if (!after || !before) {
    return NextResponse.json({ error: "after and before required" }, { status: 400 });
  }

  const config = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!config?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const token = decrypt(config.foursquareToken);
  const afterTs = parseInt(after);
  const beforeTs = parseInt(before);
  let offset = 0;
  let total = 0;

  while (true) {
    const params = new URLSearchParams({
      oauth_token: token,
      v: "20240101",
      limit: String(LIMIT),
      offset: String(offset),
      afterTimestamp: after,
      beforeTimestamp: before,
    });

    const res = await fetch(`https://api.foursquare.com/v2/users/self/checkins?${params}`);
    if (!res.ok) {
      return NextResponse.json({ error: "foursquare fetch failed" }, { status: 502 });
    }

    const data = await res.json();
    const items: { createdAt: number }[] = data?.response?.checkins?.items ?? [];
    const filtered = items.filter((c) => c.createdAt >= afterTs && c.createdAt < beforeTs);
    total += filtered.length;

    if (items.length < LIMIT) break;
    offset += LIMIT;
  }

  return NextResponse.json({ count: total });
}
