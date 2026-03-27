import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST() {
  const tombstone = await db.syncLog.create({
    data: { type: "CLEAR" },
  });
  await db.syncLog.deleteMany({ where: { id: { not: tombstone.id } } });
  return NextResponse.json({ ok: true, tombstone });
}
