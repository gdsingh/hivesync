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
  const from: string | undefined = body.from; // "yyyy-MM-dd"
  const to: string | undefined = body.to;     // "yyyy-MM-dd"

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  const afterTimestamp = Math.floor(new Date(from).getTime() / 1000);
  // beforeTimestamp = end of the "to" day
  const beforeTimestamp = Math.floor(new Date(to + "T23:59:59").getTime() / 1000);

  if (isNaN(afterTimestamp) || isNaN(beforeTimestamp)) {
    return NextResponse.json({ error: "invalid date range" }, { status: 400 });
  }

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);

  const running = await db.syncJob.findFirst({ where: { status: "RUNNING" } });
  if (running) {
    return NextResponse.json({ error: "sync already in progress", jobId: running.id }, { status: 409 });
  }

  const job = await db.syncJob.create({
    data: {
      status: "RUNNING",
      afterTimestamp,
      beforeTimestamp,
      currentOffset: 0,
    },
  });

  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const { items, total } = await fetchCheckins(
    foursquareToken,
    0,
    afterTimestamp,
    CHUNK_SIZE,
    beforeTimestamp
  );

  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken);

  const newOffset = CHUNK_SIZE;
  const isDone = newOffset >= total || items.length < CHUNK_SIZE;

  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: isDone ? "COMPLETED" : "RUNNING",
      currentOffset: newOffset,
      totalSynced: result.synced,
      totalSkipped: result.skipped,
      totalErrors: result.errors,
      completedAt: isDone ? new Date() : null,
    },
  });

  if (isDone) {
    await db.syncLog.create({
      data: { type: "RANGE", synced: result.synced, skipped: result.skipped, errors: result.errors, fromDate: from, toDate: to },
    });
  }

  return NextResponse.json({
    jobId: job.id,
    status: isDone ? "completed" : "running",
    totalSynced: result.synced,
    totalSkipped: result.skipped,
    totalErrors: result.errors,
    currentOffset: newOffset,
    total,
  });
}
