import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { fetchStickers, type FoursquareSticker } from "@/lib/sync";
import { decrypt } from "@/lib/encrypt";
import { StickersClient } from "@/components/stickers-client";

export const metadata: Metadata = { title: "Stickers" };

export default async function StickersPage() {
  const [config, lastLog] = await Promise.all([
    db.userConfig.findUnique({ where: { id: 1 } }),
    db.syncLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  let stickers: FoursquareSticker[] = [];
  if (config?.foursquareToken) {
    stickers = await fetchStickers(decrypt(config.foursquareToken)).catch(() => []);
  }

  return <StickersClient stickers={stickers} lastSyncedAt={lastLog?.createdAt ?? null} />;
}
