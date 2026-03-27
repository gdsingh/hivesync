import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET() {
  const config = await db.userConfig.findUnique({ where: { id: 1 } });

  return NextResponse.json({
    foursquareConnected: !!config?.foursquareToken,
    foursquareDisplayName: config?.foursquareDisplayName ?? null,
    foursquarePhotoUrl: config?.foursquarePhotoUrl ?? null,
    googleConnected: !!config?.googleCredentialsJson,
    googleEmail: config?.googleEmail ?? null,
    googlePhotoUrl: config?.googlePhotoUrl ?? null,
  });
}
