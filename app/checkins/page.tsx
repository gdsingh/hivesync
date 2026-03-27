import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { CheckinsClient } from "@/components/checkins-client";

export const metadata: Metadata = { title: "Check-ins" };

const PAGE_SIZE = 50;

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
}) {
  const { page: pageParam, from, to: toParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const to = toParam ?? from; // single date = from === to

  const fromTs = from ? Math.floor(new Date(from).getTime() / 1000) : undefined;
  const toTs = to ? Math.floor(new Date(to + "T23:59:59").getTime() / 1000) : undefined;

  const where = fromTs && toTs ? { checkinTimestamp: { gte: fromTs, lte: toTs } } : {};

  const [checkins, total, unfilteredTotal, lastSyncedCheckin, lastSyncedJob] = await Promise.all([
    db.syncedCheckin.findMany({
      where,
      orderBy: { checkinTimestamp: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.syncedCheckin.count({ where }),
    db.syncedCheckin.count(),
    db.syncedCheckin.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    db.syncJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
  ]);

  const candidates = [lastSyncedCheckin?.syncedAt, lastSyncedJob?.completedAt].filter(Boolean) as Date[];
  const lastSyncedAt = candidates.length > 0 ? candidates.reduce((a, b) => (a > b ? a : b)) : null;

  return (
    <CheckinsClient
      key={`${page}-${from}-${to}`}
      initialCheckins={checkins}
      total={total}
      unfilteredTotal={unfilteredTotal}
      page={page}
      pageSize={PAGE_SIZE}
      lastSyncedAt={lastSyncedAt}
      fromParam={from}
      toParam={to !== from ? to : undefined}
    />
  );
}
