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
import { getGooglePlacesLimits } from "@/lib/google-places";

const CHUNK_SIZE = 15;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const fromYearRaw = body.fromYear;
  const googlePlacesApproved = body.googlePlacesApproved === true;
  const googlePlacesLimits = await getGooglePlacesLimits();
  const googlePlacesRunLimit =
    typeof body.googlePlacesRunLimit === "number" && Number.isInteger(body.googlePlacesRunLimit) && body.googlePlacesRunLimit >= 0
      ? Math.min(body.googlePlacesRunLimit, googlePlacesLimits.monthlyLimit)
      : (googlePlacesApproved ? googlePlacesLimits.backfillRunLimit : googlePlacesLimits.dailyLimit);
  const googlePlacesAllowFallback = body.googlePlacesAllowFallback !== false;
  const fromYear: number | undefined =
    typeof fromYearRaw === "number" && Number.isInteger(fromYearRaw) && fromYearRaw >= 2000 && fromYearRaw <= new Date().getFullYear()
      ? fromYearRaw
      : undefined;

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);

  // afterTimestamp = jan 1 of the selected year, or undefined for all time
  // beforeTimestamp = jan 1 of the *next* year — scopes the sync to that year only
  const afterTimestamp = fromYear
    ? Math.floor(Date.UTC(fromYear, 0, 1) / 1000)
    : undefined;
  const beforeTimestamp = fromYear
    ? Math.floor(Date.UTC(fromYear + 1, 0, 1) / 1000)
    : undefined;

  // reject if a sync is already running
  const running = await db.syncJob.findFirst({ where: { status: "RUNNING" } });
  if (running) {
    return NextResponse.json({ error: "sync already in progress", jobId: running.id }, { status: 409 });
  }

  // create the sync job
  const job = await db.syncJob.create({
    data: {
      status: "RUNNING",
      jobType: "FULL",
      afterTimestamp: afterTimestamp ?? null,
      beforeTimestamp: beforeTimestamp ?? null,
      currentOffset: 0,
      googlePlacesApproved,
      googlePlacesRunLimit,
      googlePlacesAllowFallback,
    },
  });

  // process first chunk
  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const { items: rawItems, total } = await fetchCheckins(
    foursquareToken,
    0,
    afterTimestamp,
    CHUNK_SIZE,
    beforeTimestamp
  );

  // post-fetch filter: foursquare's timestamp params are not always strictly exclusive
  const items = rawItems.filter((c) =>
    (afterTimestamp === undefined || c.createdAt >= afterTimestamp) &&
    (beforeTimestamp === undefined || c.createdAt < beforeTimestamp)
  );

  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken, {
    mode: "backfill",
    jobId: job.id,
    googleMapsEnabled: userConfig.googleMapsEnabled,
  });

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
