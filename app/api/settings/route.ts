import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const data: { ogMode?: boolean } = {};
  if (typeof body.ogMode === "boolean") data.ogMode = body.ogMode;

  await db.userConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return NextResponse.json({ ok: true });
}
