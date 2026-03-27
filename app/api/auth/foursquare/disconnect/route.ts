import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await db.userConfig.update({
    where: { id: 1 },
    data: {
      foursquareToken: null,
      foursquareUserId: null,
      foursquareDisplayName: null,
      foursquarePhotoUrl: null,
    },
  });

  return NextResponse.json({ ok: true });
}
