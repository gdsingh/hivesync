import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { StatsClient } from "@/components/stats-client";
import { fetchStickers, type FoursquareSticker } from "@/lib/sync";
import { decrypt } from "@/lib/encrypt";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage() {
  const config = await db.userConfig.findUnique({ where: { id: 1 } });

  let stickers: FoursquareSticker[] = [];
  if (config?.foursquareToken) {
    stickers = await fetchStickers(decrypt(config.foursquareToken)).catch(() => []);
  }
  const featuredSticker = stickers.length > 0 ? stickers[Math.floor(Math.random() * stickers.length)] : null;

  const [
    totalCheckins,
    topVenuesRaw,
    topCitiesRaw,
    topCategoriesRaw,
    allTimestamps,
    mayorCheckins,
    lastSyncedCheckin,
    lastSyncedJob,
    firstCheckin,
    uniqueVenuesRaw,
    mayorshipsAllTime,
  ] = await Promise.all([
    db.syncedCheckin.count(),
    db.syncedCheckin.groupBy({
      by: ["venueId", "venueName"],
      where: { venueId: { not: null } },
      _count: { checkinId: true },
      orderBy: { _count: { checkinId: "desc" } },
      take: 10,
    }),
    db.syncedCheckin.groupBy({
      by: ["venueCity"],
      where: { venueCity: { not: null } },
      _count: { checkinId: true },
      orderBy: { _count: { checkinId: "desc" } },
      take: 5,
    }),
    db.syncedCheckin.groupBy({
      by: ["venueCategory"],
      where: { venueCategory: { not: null } },
      _count: { checkinId: true },
      orderBy: { _count: { checkinId: "desc" } },
      take: 10,
    }),
    db.syncedCheckin.findMany({
      where: { checkinTimestamp: { not: null } },
      select: { checkinTimestamp: true },
    }),
    db.syncedCheckin.findMany({
      where: { venueId: { not: null } },
      select: { venueId: true, venueName: true, isMayor: true, checkinTimestamp: true },
      orderBy: { checkinTimestamp: "asc" },
    }),
    db.syncedCheckin.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    db.syncJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
    db.syncedCheckin.findFirst({ orderBy: { checkinTimestamp: "asc" }, where: { checkinTimestamp: { not: null } }, select: { checkinTimestamp: true } }),
    db.syncedCheckin.groupBy({ by: ["venueId"], where: { venueId: { not: null } } }),
    db.syncedCheckin.count({ where: { isMayor: true } }),
  ]);

  const syncCandidates = [lastSyncedCheckin?.syncedAt, lastSyncedJob?.completedAt].filter(Boolean) as Date[];
  const lastSyncedAt = syncCandidates.length > 0 ? syncCandidates.reduce((a, b) => (a > b ? a : b)) : null;

  // compute byYear from all timestamps
  const yearMap = new Map<number, number>();
  for (const row of allTimestamps) {
    if (row.checkinTimestamp == null) continue;
    const year = new Date(row.checkinTimestamp * 1000).getFullYear();
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
  }
  const byYear = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));

  // fetch foursquare total per year for completeness coloring
  let foursquareByYear: { year: number; total: number }[] = [];
  if (config?.foursquareToken && byYear.length > 0) {
    const token = decrypt(config.foursquareToken);
    foursquareByYear = await Promise.all(
      byYear.map(async ({ year }) => {
        const afterTs = Math.floor(new Date(year, 0, 1).getTime() / 1000);
        const beforeTs = Math.floor(new Date(year + 1, 0, 1).getTime() / 1000);
        try {
          const params = new URLSearchParams({
            oauth_token: token,
            v: "20240101",
            limit: "1",
            afterTimestamp: String(afterTs),
            beforeTimestamp: String(beforeTs),
          });
          const res = await fetch(`https://api.foursquare.com/v2/users/self/checkins?${params}`);
          if (!res.ok) return { year, total: 0 };
          const data = await res.json();
          return { year, total: data?.response?.checkins?.count ?? 0 };
        } catch {
          return { year, total: 0 };
        }
      })
    );
  }

  // compute byDayOfWeek from all timestamps
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap = new Map<number, number>();
  for (let i = 0; i < 7; i++) dowMap.set(i, 0);
  for (const row of allTimestamps) {
    if (row.checkinTimestamp == null) continue;
    const dow = new Date(row.checkinTimestamp * 1000).getDay();
    dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1);
  }
  const byDayOfWeek = Array.from(dowMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dow, count]) => ({ day: DAY_NAMES[dow], count }));

  // compute byHourOfDay from all timestamps
  const hourMap = new Map<number, number>();
  for (let i = 0; i < 24; i++) hourMap.set(i, 0);
  for (const row of allTimestamps) {
    if (row.checkinTimestamp == null) continue;
    const hour = new Date(row.checkinTimestamp * 1000).getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }
  const byHourOfDay = Array.from(hourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  // compute mayorship gains/losses/current from check-in history
  const venueCheckins = new Map<string, { isMayor: boolean; venueName: string | null; ts: number }[]>();
  for (const c of mayorCheckins) {
    if (!c.venueId || c.checkinTimestamp == null) continue;
    if (!venueCheckins.has(c.venueId)) venueCheckins.set(c.venueId, []);
    venueCheckins.get(c.venueId)!.push({ isMayor: c.isMayor, venueName: c.venueName, ts: c.checkinTimestamp });
  }

  let mayorGains = 0;
  let mayorLosses = 0;

  for (const [, checkins] of venueCheckins) {
    const sorted = checkins.sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < sorted.length; i++) {
      if (!sorted[i - 1].isMayor && sorted[i].isMayor) mayorGains++;
      if (sorted[i - 1].isMayor && !sorted[i].isMayor) mayorLosses++;
    }
    if (sorted[0].isMayor) mayorGains++;
  }


  const topVenues = topVenuesRaw.map((v) => ({
    venueId: v.venueId,
    venueName: v.venueName,
    count: v._count.checkinId,
  }));

  const topCities = topCitiesRaw.map((c) => ({
    city: c.venueCity!,
    count: c._count.checkinId,
  }));

  const topCategories = topCategoriesRaw.map((c) => ({
    category: c.venueCategory!,
    count: c._count.checkinId,
  }));

  // build google maps static map url for top cities if api key is available
  let mapUrl: string | null = null;
  if (process.env.GOOGLE_MAPS_API_KEY && topCities.length > 0) {
    const base = "https://maps.googleapis.com/maps/api/staticmap";
    const params = new URLSearchParams({
      size: "600x250",
      scale: "2",
      maptype: "roadmap",
      key: process.env.GOOGLE_MAPS_API_KEY,
    });

    // assign each city a heat tier 1-5 based on its rank in the sorted list
    // tier 5 = most visited (top 20%), tier 1 = least visited (bottom 20%)
    const tierConfig = [
      { size: "tiny",  color: "0x93c5fd" }, // tier 1 — light blue
      { size: "tiny",  color: "0x60a5fa" }, // tier 2 — blue
      { size: "small", color: "0xfbbf24" }, // tier 3 — amber
      { size: "small", color: "0xf97316" }, // tier 4 — orange
      { size: "mid",   color: "0xef4444" }, // tier 5 — red (most visited)
    ];

    // group cities by tier — topCities is already sorted desc by count
    const n = topCities.length;
    const tierGroups: string[][] = [[], [], [], [], []];
    topCities.forEach((c, i) => {
      const tier = n === 1 ? 4 : Math.min(4, Math.floor((i / n) * 5));
      // invert: index 0 (highest count) → tier 5, last index → tier 1
      const invertedTier = 4 - tier;
      tierGroups[invertedTier].push(encodeURIComponent(c.city));
    });

    const markerParams = tierGroups
      .flatMap((cities, tier) =>
        cities.map((city) =>
          `markers=color:${tierConfig[tier].color}|size:${tierConfig[tier].size}|${city}`
        )
      )
      .join("&");

    mapUrl = `${base}?${params.toString()}&${markerParams}`;
  }

  const uniqueVenues = uniqueVenuesRaw.length;

  return (
    <StatsClient
      totalCheckins={totalCheckins}
      uniqueVenues={uniqueVenues}
      mayorGains={mayorGains}
      mayorLosses={mayorLosses}
      mayorshipsAllTime={mayorshipsAllTime}
      topVenues={topVenues}
      topCities={topCities}
      topCategories={topCategories}
      byYear={byYear}
      foursquareByYear={foursquareByYear}
      byDayOfWeek={byDayOfWeek}
      byHourOfDay={byHourOfDay}
      lastSyncedAt={lastSyncedAt}
      firstCheckinTimestamp={firstCheckin?.checkinTimestamp ?? null}
      mapUrl={mapUrl}
      stickers={stickers}
      featuredSticker={featuredSticker}
    />
  );
}
