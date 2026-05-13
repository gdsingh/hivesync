import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { fetchCheckins, type FoursquareCheckin, type FoursquareVenue } from "@/lib/sync";
import { getGooglePlacesUsageStatus, getUniqueVenueIds } from "@/lib/google-places";

const LIMIT = 250;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const afterTimestamp = typeof body.afterTimestamp === "number" ? body.afterTimestamp : undefined;
  const beforeTimestamp = typeof body.beforeTimestamp === "number" ? body.beforeTimestamp : undefined;
  const requestedRunLimit =
    typeof body.googlePlacesRunLimit === "number" && Number.isInteger(body.googlePlacesRunLimit) && body.googlePlacesRunLimit >= 0
      ? body.googlePlacesRunLimit
      : undefined;

  if (afterTimestamp == null || beforeTimestamp == null) {
    return NextResponse.json({ error: "afterTimestamp and beforeTimestamp required" }, { status: 400 });
  }

  const config = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!config?.foursquareToken) {
    return NextResponse.json({ error: "foursquare not connected" }, { status: 400 });
  }

  const token = decrypt(config.foursquareToken);
  let offset = 0;
  const candidates: Array<{ id: string; venue?: FoursquareVenue }> = [];
  let total = 0;

  while (true) {
    const { items, total: apiTotal } = await fetchCheckins(
      token,
      offset,
      afterTimestamp,
      LIMIT,
      beforeTimestamp
    );
    total = apiTotal;

    const filtered = items.filter((c) =>
      c.createdAt >= afterTimestamp &&
      c.createdAt < beforeTimestamp
    );
    candidates.push(...filtered.map((c: FoursquareCheckin) => ({ id: c.id, venue: c.venue })));

    offset += LIMIT;
    if (offset >= apiTotal || items.length < LIMIT) break;
  }

  const checkinIds = candidates.map((c) => c.id);
  const existingCheckins = checkinIds.length
    ? await db.syncedCheckin.findMany({
        where: { checkinId: { in: checkinIds } },
        select: { checkinId: true },
      })
    : [];
  const existingIds = new Set(existingCheckins.map((c) => c.checkinId));
  const venuesToSync = candidates
    .filter((c) => !existingIds.has(c.id))
    .map((c) => c.venue)
    .filter(Boolean) as FoursquareVenue[];

  const candidateVenueIds = getUniqueVenueIds(venuesToSync);
  const cached = candidateVenueIds.length
    ? await db.venueEnrichment.findMany({
        where: {
          foursquareVenueId: { in: candidateVenueIds },
          googleFormattedAddress: { not: null },
        },
        select: { foursquareVenueId: true },
      })
    : [];
  const cachedIds = new Set(cached.map((v) => v.foursquareVenueId));
  const estimatedGoogleCalls = candidateVenueIds.filter((id) => !cachedIds.has(id)).length;
  const usage = await getGooglePlacesUsageStatus();
  const dailyRemaining = Math.max(0, usage.dailyLimit - usage.todayCalls);
  const monthlyRemaining = Math.max(0, usage.monthlyLimit - usage.monthCalls);
  const backfillRemaining = requestedRunLimit ?? usage.backfillRunLimit;
  const confirmationRequired = usage.hasKey && estimatedGoogleCalls > usage.dailyLimit;
  const allowance = confirmationRequired
    ? Math.min(monthlyRemaining, backfillRemaining)
    : Math.min(dailyRemaining, monthlyRemaining, backfillRemaining);

  return NextResponse.json({
    totalCheckins: total,
    candidateCheckins: checkinIds.length - existingIds.size,
    uniqueUncachedVenues: estimatedGoogleCalls,
    estimatedGoogleCalls,
    dailyRemaining,
    monthlyRemaining,
    backfillRemaining,
    fallbackCount: Math.max(0, estimatedGoogleCalls - allowance),
    confirmationRequired,
    usage,
  });
}
