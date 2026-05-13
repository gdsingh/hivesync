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
import { getGooglePlacesLimits } from "@/lib/google-places";

const CHUNK_SIZE = 15;
const RANGE_FETCH_SIZE = 250;

function parseDateOnlyToUtcTimestamp(value: string, addDays = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return NaN;

  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day) + addDays) / 1000);
}

function getRequestTimestamp(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

async function fetchExactRangeCheckins(token: string, afterTimestamp: number, beforeTimestamp: number) {
  let offset = 0;
  const exactItems: FoursquareCheckin[] = [];

  while (true) {
    const { items, total } = await fetchCheckins(
      token,
      offset,
      afterTimestamp,
      RANGE_FETCH_SIZE,
      beforeTimestamp
    );

    exactItems.push(...items.filter((c) =>
      c.createdAt >= afterTimestamp &&
      c.createdAt < beforeTimestamp
    ));

    const oldestItem = items.reduce<number | null>(
      (oldest, item) => oldest == null ? item.createdAt : Math.min(oldest, item.createdAt),
      null
    );

    offset += RANGE_FETCH_SIZE;
    if (
      offset >= total ||
      items.length < RANGE_FETCH_SIZE ||
      (oldestItem != null && oldestItem < afterTimestamp)
    ) {
      break;
    }
  }

  return exactItems;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const from: string | undefined = body.from; // "yyyy-MM-dd"
  const to: string | undefined = body.to;     // "yyyy-MM-dd"
  const expectedCheckins =
    typeof body.expectedCheckins === "number" && Number.isInteger(body.expectedCheckins) && body.expectedCheckins >= 0
      ? body.expectedCheckins
      : undefined;
  const googlePlacesApproved = body.googlePlacesApproved === true;
  const googlePlacesLimits = await getGooglePlacesLimits();
  const googlePlacesRunLimit =
    typeof body.googlePlacesRunLimit === "number" && Number.isInteger(body.googlePlacesRunLimit) && body.googlePlacesRunLimit >= 0
      ? Math.min(body.googlePlacesRunLimit, googlePlacesLimits.monthlyLimit)
      : (googlePlacesApproved ? googlePlacesLimits.backfillRunLimit : googlePlacesLimits.dailyLimit);
  const googlePlacesAllowFallback = body.googlePlacesAllowFallback !== false;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  const afterTimestamp = getRequestTimestamp(body.afterTimestamp) ?? parseDateOnlyToUtcTimestamp(from);
  const beforeTimestamp = getRequestTimestamp(body.beforeTimestamp) ?? parseDateOnlyToUtcTimestamp(to, 1);

  if (isNaN(afterTimestamp) || isNaN(beforeTimestamp) || beforeTimestamp <= afterTimestamp) {
    return NextResponse.json({ error: "invalid date range" }, { status: 400 });
  }

  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const foursquareToken = decrypt(userConfig.foursquareToken);
  const rangeCheckins = await fetchExactRangeCheckins(foursquareToken, afterTimestamp, beforeTimestamp);
  if (expectedCheckins != null && rangeCheckins.length > expectedCheckins + 5) {
    return NextResponse.json({
      error: `range mismatch: expected about ${expectedCheckins} check-ins, found ${rangeCheckins.length}; sync stopped before Google Maps calls`,
      expectedCheckins,
      foundCheckins: rangeCheckins.length,
    }, { status: 409 });
  }

  const running = await db.syncJob.findFirst({ where: { status: "RUNNING" } });
  if (running) {
    return NextResponse.json({ error: "sync already in progress", jobId: running.id }, { status: 409 });
  }

  const job = await db.syncJob.create({
    data: {
      status: "RUNNING",
      jobType: "RANGE",
      afterTimestamp,
      beforeTimestamp,
      currentOffset: 0,
      googlePlacesApproved,
      googlePlacesRunLimit,
      googlePlacesAllowFallback,
      rangeCheckins: rangeCheckins as unknown as object[],
    },
  });

  const auth = await getGoogleAuth();
  const calendarService = google.calendar({ version: "v3", auth });
  const calendarId = await ensureSwarmCalendar(calendarService);

  const items = rangeCheckins.slice(0, CHUNK_SIZE);

  const result = await syncCheckins(items, calendarService, calendarId, foursquareToken, {
    mode: "backfill",
    jobId: job.id,
  });

  const newOffset = items.length;
  const isDone = newOffset >= rangeCheckins.length;

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
    total: rangeCheckins.length,
  });
}
