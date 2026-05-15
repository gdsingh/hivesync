import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.syncLog.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
