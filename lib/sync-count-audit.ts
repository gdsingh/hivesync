import { db } from "@/lib/prisma";

export const FIRST_FOURSQUARE_YEAR = 2009;
const AUDIT_ID = 1;

type YearCount = {
  foursquare: number;
  synced: number;
};

type CheckedYears = Record<string, YearCount>;

function currentYear() {
  return new Date().getFullYear();
}

function normalizeCheckedYears(value: unknown): CheckedYears {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const checked: CheckedYears = {};
  for (const [year, counts] of Object.entries(value as Record<string, unknown>)) {
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) continue;
    const maybeCounts = counts as Record<string, unknown>;
    const foursquare = Number(maybeCounts.foursquare);
    const synced = Number(maybeCounts.synced);
    if (!Number.isFinite(foursquare) || !Number.isFinite(synced)) continue;
    checked[year] = { foursquare, synced };
  }
  return checked;
}

function summarize(checkedYears: CheckedYears, totalCheckins: number | null, totalSynced: number, lastYear: number) {
  const expectedYearCount = lastYear - FIRST_FOURSQUARE_YEAR + 1;
  const foundInCheckedYears = Object.values(checkedYears).reduce(
    (sum, counts) => sum + Math.max(0, counts.foursquare - counts.synced),
    0
  );
  const completed = Object.keys(checkedYears).length >= expectedYearCount;
  const unaccountedCheckins = totalCheckins == null ? null : Math.max(0, totalCheckins - totalSynced - foundInCheckedYears);

  return { foundInCheckedYears, completed, unaccountedCheckins };
}

export async function getSyncCountAudit() {
  const audit = await db.syncCountAudit.findUnique({ where: { id: AUDIT_ID } });
  if (!audit) return null;

  return {
    firstYear: audit.firstYear,
    lastYear: audit.lastYear,
    checkedYears: normalizeCheckedYears(audit.checkedYears),
    totalCheckins: audit.totalCheckins,
    totalSynced: audit.totalSynced,
    foundInCheckedYears: audit.foundInCheckedYears,
    unaccountedCheckins: audit.unaccountedCheckins,
    completed: audit.completed,
    checkedAt: audit.checkedAt,
  };
}

export async function updateSyncCountAudit(input: {
  year: number;
  foursquare: number;
  synced: number;
  totalCheckins?: number | null;
}) {
  const lastYear = currentYear();
  if (input.year < FIRST_FOURSQUARE_YEAR || input.year > lastYear) {
    throw new Error("year outside available range");
  }

  const totalSynced = await db.syncedCheckin.count();
  const existing = await db.syncCountAudit.findUnique({ where: { id: AUDIT_ID } });
  const checkedYears = normalizeCheckedYears(existing?.checkedYears);
  checkedYears[String(input.year)] = {
    foursquare: Math.max(0, Math.floor(input.foursquare)),
    synced: Math.max(0, Math.floor(input.synced)),
  };

  const totalCheckins =
    typeof input.totalCheckins === "number" && Number.isFinite(input.totalCheckins)
      ? Math.max(0, Math.floor(input.totalCheckins))
      : existing?.totalCheckins ?? null;
  const summary = summarize(checkedYears, totalCheckins, totalSynced, lastYear);

  const audit = await db.syncCountAudit.upsert({
    where: { id: AUDIT_ID },
    create: {
      id: AUDIT_ID,
      firstYear: FIRST_FOURSQUARE_YEAR,
      lastYear,
      checkedYears,
      totalCheckins,
      totalSynced,
      foundInCheckedYears: summary.foundInCheckedYears,
      unaccountedCheckins: summary.unaccountedCheckins,
      completed: summary.completed,
      checkedAt: new Date(),
    },
    update: {
      firstYear: FIRST_FOURSQUARE_YEAR,
      lastYear,
      checkedYears,
      totalCheckins,
      totalSynced,
      foundInCheckedYears: summary.foundInCheckedYears,
      unaccountedCheckins: summary.unaccountedCheckins,
      completed: summary.completed,
      checkedAt: new Date(),
    },
  });

  return {
    firstYear: audit.firstYear,
    lastYear: audit.lastYear,
    checkedYears: normalizeCheckedYears(audit.checkedYears),
    totalCheckins: audit.totalCheckins,
    totalSynced: audit.totalSynced,
    foundInCheckedYears: audit.foundInCheckedYears,
    unaccountedCheckins: audit.unaccountedCheckins,
    completed: audit.completed,
    checkedAt: audit.checkedAt,
  };
}
