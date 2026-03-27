import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { HistoryClient } from "@/components/history-client";

export const metadata: Metadata = { title: "Sync History" };

export default async function HistoryPage() {
  const [logs, lastSyncedCheckin, lastSyncedJob] = await Promise.all([
    db.syncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, synced: true, skipped: true, errors: true, errorMessage: true, fromDate: true, toDate: true, createdAt: true },
    }),
    db.syncedCheckin.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    db.syncJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
  ]);

  const candidates = [lastSyncedCheckin?.syncedAt, lastSyncedJob?.completedAt].filter(Boolean) as Date[];
  const lastSyncedAt = candidates.length > 0 ? candidates.reduce((a, b) => (a > b ? a : b)) : null;

  return <HistoryClient logs={logs} lastSyncedAt={lastSyncedAt} />;
}
