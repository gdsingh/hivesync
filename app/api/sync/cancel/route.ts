import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined = body.jobId;

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await db.syncJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage: "cancelled by user", completedAt: new Date() },
  });

  const fromDate = job.afterTimestamp ? new Date(job.afterTimestamp * 1000).toISOString().slice(0, 10) : undefined;
  const toDate = job.beforeTimestamp ? new Date(job.beforeTimestamp * 1000).toISOString().slice(0, 10) : undefined;
  const fromYear = fromDate ? parseInt(fromDate.slice(0, 4)) : null;
  const toYear = toDate ? parseInt(toDate.slice(0, 4)) : null;
  const isYearly = fromDate?.endsWith("-01-01") && toDate?.endsWith("-01-01") && toYear === (fromYear ?? 0) + 1;
  const type = job.beforeTimestamp != null && !isYearly ? "RANGE" : "FULL";
  await db.syncLog.create({
    data: {
      type,
      synced: job.totalSynced,
      skipped: job.totalSkipped,
      errors: job.totalErrors,
      errorMessage: "stopped by user",
      fromDate,
    },
  });

  return NextResponse.json({ ok: true });
}
