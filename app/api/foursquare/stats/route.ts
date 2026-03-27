import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";

export async function GET() {
  const config = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!config?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const params = new URLSearchParams({ oauth_token: decrypt(config.foursquareToken), v: "20240101" });
  const res = await fetch(`https://api.foursquare.com/v2/users/self?${params}`);
  if (!res.ok) {
    return NextResponse.json({ error: "foursquare fetch failed" }, { status: 502 });
  }

  const data = await res.json();
  const user = data?.response?.user;

  return NextResponse.json({
    totalCheckins: user?.checkins?.count ?? null,
  });
}
