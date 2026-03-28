import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

function buildMapUrl(topCities: { city: string; count: number }[]): string | null {
  if (!process.env.GOOGLE_MAPS_API_KEY || topCities.length === 0) return null;

  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const params = new URLSearchParams({
    size: "600x250",
    scale: "2",
    maptype: "roadmap",
    key: process.env.GOOGLE_MAPS_API_KEY,
  });

  const tierConfig = [
    { size: "tiny",  color: "0x93c5fd" },
    { size: "tiny",  color: "0x60a5fa" },
    { size: "small", color: "0xfbbf24" },
    { size: "small", color: "0xf97316" },
    { size: "mid",   color: "0xef4444" },
  ];

  const n = topCities.length;
  const tierGroups: string[][] = [[], [], [], [], []];
  topCities.forEach((c, i) => {
    const tier = n === 1 ? 4 : Math.min(4, Math.floor((i / n) * 5));
    tierGroups[4 - tier].push(encodeURIComponent(c.city));
  });

  const markerParams = tierGroups
    .flatMap((cities, tier) =>
      cities.map((city) => `markers=color:${tierConfig[tier].color}|size:${tierConfig[tier].size}|${city}`)
    )
    .join("&");

  return `${base}?${params.toString()}&${markerParams}`;
}

async function getCities(afterTs?: number, beforeTs?: number) {
  const tsFilter = afterTs
    ? beforeTs ? { gte: afterTs, lt: beforeTs } : { gte: afterTs }
    : undefined;

  const rows = await db.syncedCheckin.groupBy({
    by: ["venueCity"],
    where: { venueCity: { not: null }, ...(tsFilter ? { checkinTimestamp: tsFilter } : {}) },
    _count: { checkinId: true },
    orderBy: { _count: { checkinId: "desc" } },
    take: 5,
  });

  return rows.map((r) => ({ city: r.venueCity!, count: r._count.checkinId }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let cities: { city: string; count: number }[];

  if (from && to) {
    const afterTs = Math.floor(new Date(from).getTime() / 1000);
    const beforeTs = Math.floor(new Date(to + "T23:59:59").getTime() / 1000);
    cities = await getCities(afterTs, beforeTs);
  } else if (period === "all") {
    cities = await getCities();
  } else {
    const now = Math.floor(Date.now() / 1000);
    let afterTs: number;
    let beforeTs: number | undefined;

    if (period === "week") {
      afterTs = now - 7 * 24 * 60 * 60;
    } else if (period === "30d") {
      afterTs = now - 30 * 24 * 60 * 60;
    } else if (period === "90d") {
      afterTs = now - 90 * 24 * 60 * 60;
    } else if (period === "year" || /^\d{4}$/.test(period)) {
      const y = period === "year" ? new Date().getFullYear() : parseInt(period);
      afterTs = Math.floor(new Date(y, 0, 1).getTime() / 1000);
      beforeTs = Math.floor(new Date(y + 1, 0, 1).getTime() / 1000);
    } else {
      afterTs = 0;
    }

    cities = await getCities(afterTs, beforeTs);
  }

  return NextResponse.json({ cities, mapUrl: buildMapUrl(cities) });
}
