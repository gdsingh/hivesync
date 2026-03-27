import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await db.syncJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status.toLowerCase(),
    totalSynced: job.totalSynced,
    totalSkipped: job.totalSkipped,
    totalErrors: job.totalErrors,
    currentOffset: job.currentOffset,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}
