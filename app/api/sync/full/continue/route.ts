import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import {
  getGoogleAuth,
  ensureSwarmCalendar,
  fetchCheckins,
  syncCheckins,
} from "@/lib/sync";

const CHUNK_SIZE = 15;

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
  if (job.status === "COMPLETED" || job.status === "FAILED") {
    return NextResponse.json({
      jobId: job.id,
      status: job.status.toLowerCase(),
      totalSynced: job.totalSynced,
      totalSkipped: job.totalSkipped,
      totalErrors: job.totalErrors,
    });
  }

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    await db.syncJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "foursquare not connected", completedAt: new Date() },
    });
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);
  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const { items: rawItems, total } = await fetchCheckins(
    foursquareToken,
    job.currentOffset,
    job.afterTimestamp ?? undefined,
    CHUNK_SIZE,
    job.beforeTimestamp ?? undefined
  );

  // post-fetch filter: foursquare's timestamp params are not always strictly exclusive
  const after = job.afterTimestamp ?? undefined;
  const before = job.beforeTimestamp ?? undefined;
  const items = rawItems.filter((c) =>
    (after === undefined || c.createdAt >= after) &&
    (before === undefined || c.createdAt < before)
  );

  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken);

  const newOffset = job.currentOffset + CHUNK_SIZE;
  const isDone = newOffset >= total || items.length < CHUNK_SIZE;

  const updated = await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: isDone ? "COMPLETED" : "RUNNING",
      currentOffset: newOffset,
      totalSynced: job.totalSynced + result.synced,
      totalSkipped: job.totalSkipped + result.skipped,
      totalErrors: job.totalErrors + result.errors,
      completedAt: isDone ? new Date() : null,
    },
  });

  if (isDone) {
    const fromDate = job.afterTimestamp ? new Date(job.afterTimestamp * 1000).toISOString().slice(0, 10) : undefined;
    const toDate = job.beforeTimestamp ? new Date(job.beforeTimestamp * 1000).toISOString().slice(0, 10) : undefined;
    await db.syncLog.create({
      data: { type: "FULL", synced: updated.totalSynced, skipped: updated.totalSkipped, errors: updated.totalErrors, fromDate, toDate },
    });
  }

  return NextResponse.json({
    jobId: job.id,
    status: isDone ? "completed" : "running",
    totalSynced: updated.totalSynced,
    totalSkipped: updated.totalSkipped,
    totalErrors: updated.totalErrors,
    currentOffset: updated.currentOffset,
    total,
  });
}
