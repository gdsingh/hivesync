import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import {
  getGoogleAuth,
  ensureSwarmCalendar,
  fetchCheckins,
  syncCheckins,
  type FoursquareCheckin,
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

  const claimedOffset = job.currentOffset;
  const claimed = await db.syncJob.updateMany({
    where: { id: jobId, status: "RUNNING", currentOffset: claimedOffset },
    data: { currentOffset: claimedOffset + CHUNK_SIZE },
  });
  if (claimed.count === 0) {
    const latest = await db.syncJob.findUnique({ where: { id: jobId } });
    return NextResponse.json({
      jobId: job.id,
      status: latest?.status.toLowerCase() ?? "running",
      totalSynced: latest?.totalSynced ?? job.totalSynced,
      totalSkipped: latest?.totalSkipped ?? job.totalSkipped,
      totalErrors: latest?.totalErrors ?? job.totalErrors,
      currentOffset: latest?.currentOffset ?? job.currentOffset,
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

  const rangeCheckins = Array.isArray(job.rangeCheckins)
    ? (job.rangeCheckins as unknown as FoursquareCheckin[])
    : null;
  let total: number;
  let items: FoursquareCheckin[];

  if (job.jobType === "RANGE") {
    if (!rangeCheckins) {
      await db.syncJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: "range sync window unavailable; restart this range sync",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({
        jobId: job.id,
        status: "failed",
        errorMessage: "range sync window unavailable; restart this range sync",
        totalSynced: job.totalSynced,
        totalSkipped: job.totalSkipped,
        totalErrors: job.totalErrors,
      });
    }

    total = rangeCheckins.length;
    items = rangeCheckins.slice(claimedOffset, claimedOffset + CHUNK_SIZE);
  } else {
    const { items: rawItems, total: apiTotal } = await fetchCheckins(
      foursquareToken,
      claimedOffset,
      job.afterTimestamp ?? undefined,
      CHUNK_SIZE,
      job.beforeTimestamp ?? undefined
    );

    // post-fetch filter: foursquare's timestamp params are not always strictly exclusive
    const after = job.afterTimestamp ?? undefined;
    const before = job.beforeTimestamp ?? undefined;
    total = apiTotal;
    items = rawItems.filter((c) =>
      (after === undefined || c.createdAt >= after) &&
      (before === undefined || c.createdAt < before)
    );
  }

  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken, {
    mode: "backfill",
    jobId: job.id,
    googleMapsEnabled: userConfig.googleMapsEnabled,
  });

  const newOffset = claimedOffset + CHUNK_SIZE;
  const isDone = newOffset >= total || items.length < CHUNK_SIZE;

  const updated = await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: isDone ? "COMPLETED" : "RUNNING",
      totalSynced: { increment: result.synced },
      totalSkipped: { increment: result.skipped },
      totalErrors: { increment: result.errors },
      completedAt: isDone ? new Date() : null,
    },
  });

  if (isDone) {
    const fromDate = job.afterTimestamp ? new Date(job.afterTimestamp * 1000).toISOString().slice(0, 10) : undefined;
    const toDate = job.beforeTimestamp ? new Date(job.beforeTimestamp * 1000).toISOString().slice(0, 10) : undefined;
    await db.syncLog.create({
      data: { type: job.jobType === "RANGE" ? "RANGE" : "FULL", synced: updated.totalSynced, skipped: updated.totalSkipped, errors: updated.totalErrors, fromDate, toDate },
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
