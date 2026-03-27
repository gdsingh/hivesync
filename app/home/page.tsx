import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = { title: "Home" };

export default async function Home() {
  const config = await db.userConfig.findUnique({ where: { id: 1 } });
  const totalSynced = await db.syncedCheckin.count();
  const lastSynced = await db.syncedCheckin.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } });
  const lastJob = await db.syncJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } });

  const candidates = [lastSynced?.syncedAt, lastJob?.completedAt].filter(Boolean) as Date[];
  const lastSyncedAt = candidates.length > 0 ? candidates.reduce((a, b) => (a > b ? a : b)) : null;

  return (
    <Dashboard
      foursquareConnected={!!config?.foursquareToken}
      foursquareDisplayName={config?.foursquareDisplayName ?? null}
      foursquarePhotoUrl={config?.foursquarePhotoUrl ?? null}
      googleConnected={!!config?.googleCredentialsJson}
      googleEmail={config?.googleEmail ?? null}
      googlePhotoUrl={config?.googlePhotoUrl ?? null}
      totalSynced={totalSynced}
      ogMode={config?.ogMode ?? false}
      lastSyncedAt={lastSyncedAt}
    />
  );
}
