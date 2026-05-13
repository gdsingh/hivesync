import { db } from "@/lib/prisma";
import type { FoursquareVenue } from "@/lib/sync";

const DEFAULT_DAILY_LIMIT = 25;
const DEFAULT_MONTHLY_LIMIT = 500;
const DEFAULT_BACKFILL_RUN_LIMIT = 250;
const DEFAULT_WARNING_THRESHOLD = 0.8;
const FAILED_LOOKUP_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

export type GooglePlacesMode = "normal" | "backfill";

export interface GooglePlacesContext {
  mode?: GooglePlacesMode;
  jobId?: string;
}

export interface VenueLocationResult {
  location: string;
  source: "google" | "foursquare";
  skippedReason?: string;
}

export interface GooglePlacesUsageStatus {
  hasKey: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  backfillRunLimit: number;
  warningThreshold: number;
  todayCalls: number;
  monthCalls: number;
  totalCalls: number;
  todayCacheHits: number;
  monthCacheHits: number;
  totalCacheHits: number;
  cacheCount: number;
  mappedVenueCount: number;
  lookupStatusCounts: Record<string, number>;
  limitsOverridden: boolean;
  status: "no_key" | "enabled" | "near_limit" | "capped" | "error";
}

function formatVenueLocation(venue: FoursquareVenue): string {
  const loc = venue.location;
  if (!loc) return venue.name;

  const address =
    loc.formattedAddress?.join(", ") ??
    [loc.address, loc.city, loc.state, loc.postalCode, loc.country]
      .filter(Boolean)
      .join(", ");

  return address ? `${venue.name}, ${address}` : venue.name;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function floatFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

function getGooglePlacesLimitDefaults() {
  return {
    dailyLimit: intFromEnv("GOOGLE_PLACES_DAILY_LIMIT", DEFAULT_DAILY_LIMIT),
    monthlyLimit: intFromEnv("GOOGLE_PLACES_MONTHLY_LIMIT", DEFAULT_MONTHLY_LIMIT),
    backfillRunLimit: intFromEnv("GOOGLE_PLACES_BACKFILL_RUN_LIMIT", DEFAULT_BACKFILL_RUN_LIMIT),
    warningThreshold: floatFromEnv("GOOGLE_PLACES_WARNING_THRESHOLD", DEFAULT_WARNING_THRESHOLD),
  };
}

export async function getGooglePlacesLimits() {
  const defaults = getGooglePlacesLimitDefaults();
  const settings = await db.googlePlacesSettings.findUnique({ where: { id: 1 } });

  return {
    dailyLimit: settings?.dailyLimit ?? defaults.dailyLimit,
    monthlyLimit: settings?.monthlyLimit ?? defaults.monthlyLimit,
    backfillRunLimit: settings?.backfillRunLimit ?? defaults.backfillRunLimit,
    warningThreshold: settings?.warningThreshold ?? defaults.warningThreshold,
    limitsOverridden: !!settings && (
      settings.dailyLimit != null ||
      settings.monthlyLimit != null ||
      settings.backfillRunLimit != null ||
      settings.warningThreshold != null
    ),
  };
}

export async function updateGooglePlacesLimits(input: {
  dailyLimit: number;
  monthlyLimit: number;
  backfillRunLimit: number;
}) {
  const defaults = getGooglePlacesLimitDefaults();
  const dailyLimit = Math.max(0, Math.floor(input.dailyLimit));
  const monthlyLimit = Math.max(dailyLimit, Math.floor(input.monthlyLimit));
  const backfillRunLimit = Math.max(0, Math.min(monthlyLimit, Math.floor(input.backfillRunLimit)));

  await db.googlePlacesSettings.upsert({
    where: { id: 1 },
    update: {
      dailyLimit,
      monthlyLimit,
      backfillRunLimit,
      warningThreshold: defaults.warningThreshold,
    },
    create: {
      id: 1,
      dailyLimit,
      monthlyLimit,
      backfillRunLimit,
      warningThreshold: defaults.warningThreshold,
    },
  });

  return getGooglePlacesUsageStatus();
}

function usageDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function usageMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

async function recordGooglePlacesCacheHit(foursquareVenueId: string) {
  const today = usageDate();
  await Promise.all([
    db.googlePlacesUsage.upsert({
      where: { date: today },
      update: { cacheHits: { increment: 1 } },
      create: { date: today, calls: 0, cacheHits: 1 },
    }),
    db.venueEnrichment.update({
      where: { foursquareVenueId },
      data: {
        cacheHits: { increment: 1 },
        lastCacheHitAt: new Date(),
      },
    }),
  ]);
}

export async function getGooglePlacesUsageStatus(): Promise<GooglePlacesUsageStatus> {
  const limits = await getGooglePlacesLimits();
  const today = usageDate();
  const month = usageMonth();
  const [todayUsage, monthUsageRows, totalUsageRows, cacheCount, mappedVenueCount, lookupStatusRows] = await Promise.all([
    db.googlePlacesUsage.findUnique({ where: { date: today }, select: { calls: true, cacheHits: true } }),
    db.googlePlacesUsage.findMany({ where: { date: { startsWith: month } }, select: { calls: true, cacheHits: true } }),
    db.googlePlacesUsage.findMany({ select: { calls: true, cacheHits: true } }),
    db.venueEnrichment.count(),
    db.venueEnrichment.count({ where: { googlePlaceId: { not: null } } }),
    db.venueEnrichment.groupBy({
      by: ["googleLookupStatus"],
      _count: { googleLookupStatus: true },
    }),
  ]);

  const todayCalls = todayUsage?.calls ?? 0;
  const monthCalls = monthUsageRows.reduce((sum, row) => sum + row.calls, 0);
  const totalCalls = totalUsageRows.reduce((sum, row) => sum + row.calls, 0);
  const todayCacheHits = todayUsage?.cacheHits ?? 0;
  const monthCacheHits = monthUsageRows.reduce((sum, row) => sum + row.cacheHits, 0);
  const totalCacheHits = totalUsageRows.reduce((sum, row) => sum + row.cacheHits, 0);
  const lookupStatusCounts = Object.fromEntries(
    lookupStatusRows.map((row) => [row.googleLookupStatus.toLowerCase(), row._count.googleLookupStatus])
  );
  const hasKey = !!process.env.GOOGLE_MAPS_API_KEY;
  const capped = todayCalls >= limits.dailyLimit || monthCalls >= limits.monthlyLimit;
  const nearLimit =
    todayCalls >= Math.floor(limits.dailyLimit * limits.warningThreshold) ||
    monthCalls >= Math.floor(limits.monthlyLimit * limits.warningThreshold);

  return {
    hasKey,
    ...limits,
    todayCalls,
    monthCalls,
    totalCalls,
    todayCacheHits,
    monthCacheHits,
    totalCacheHits,
    cacheCount,
    mappedVenueCount,
    lookupStatusCounts,
    status: !hasKey ? "no_key" : capped ? "capped" : nearLimit ? "near_limit" : "enabled",
  };
}

async function reserveGooglePlacesCall(context: GooglePlacesContext = {}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!process.env.GOOGLE_MAPS_API_KEY) return { ok: false, reason: "no_key" };

  const limits = await getGooglePlacesLimits();
  const job = context.mode === "backfill" && context.jobId
    ? await db.syncJob.findUnique({
        where: { id: context.jobId },
        select: {
          googlePlacesApproved: true,
          googlePlacesCalls: true,
          googlePlacesRunLimit: true,
          googlePlacesAllowFallback: true,
        },
      })
    : null;
  const today = usageDate();
  const month = usageMonth();
  const [todayUsage, monthUsageRows] = await Promise.all([
    db.googlePlacesUsage.findUnique({ where: { date: today }, select: { calls: true } }),
    db.googlePlacesUsage.findMany({ where: { date: { startsWith: month } }, select: { calls: true } }),
  ]);
  const monthCalls = monthUsageRows.reduce((sum, row) => sum + row.calls, 0);

  if (!job?.googlePlacesApproved && (todayUsage?.calls ?? 0) >= limits.dailyLimit) {
    return { ok: false, reason: "daily_cap" };
  }
  if (monthCalls >= limits.monthlyLimit) return { ok: false, reason: "monthly_cap" };

  if (context.mode === "backfill" && context.jobId) {
    const runLimit = job?.googlePlacesRunLimit ?? limits.backfillRunLimit;
    if ((job?.googlePlacesCalls ?? 0) >= runLimit) {
      return { ok: false, reason: job?.googlePlacesAllowFallback === false ? "backfill_cap_no_fallback" : "backfill_cap" };
    }

    const updated = await db.syncJob.updateMany({
      where: {
        id: context.jobId,
        googlePlacesCalls: job?.googlePlacesCalls ?? 0,
      },
      data: { googlePlacesCalls: { increment: 1 } },
    });
    if (updated.count === 0) {
      return { ok: false, reason: job?.googlePlacesAllowFallback === false ? "backfill_cap_no_fallback" : "backfill_cap" };
    }
  }

  await db.googlePlacesUsage.upsert({
    where: { date: today },
    update: { calls: { increment: 1 } },
    create: { date: today, calls: 1 },
  });

  return { ok: true };
}

function snapshotVenue(venue: FoursquareVenue) {
  const loc = venue.location;
  return {
    foursquareName: venue.name,
    foursquareAddress: loc?.formattedAddress?.join(", ") ?? loc?.address ?? null,
    foursquareCity: loc?.city ?? null,
    foursquareState: loc?.state ?? null,
    foursquareCountry: loc?.country ?? null,
    foursquarePostalCode: loc?.postalCode ?? null,
    foursquareLatitude: loc?.lat ?? null,
    foursquareLongitude: loc?.lng ?? null,
  };
}

async function searchGooglePlace(venue: FoursquareVenue, context: GooglePlacesContext) {
  const reserved = await reserveGooglePlacesCall(context);
  if (!reserved.ok) return { status: "SKIPPED", reason: reserved.reason };

  const body: {
    textQuery: string;
    locationBias?: {
      circle: {
        center: { latitude: number; longitude: number };
        radius: number;
      };
    };
  } = { textQuery: formatVenueLocation(venue) };

  if (venue.location?.lat != null && venue.location?.lng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: venue.location.lat, longitude: venue.location.lng },
        radius: 100,
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": "places.id,places.formattedAddress,places.googleMapsUri",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { status: "FAILED", reason: `places_api_${res.status}` };
  }

  const data = await res.json();
  const place = data?.places?.[0];
  if (!place?.id) return { status: "NOT_FOUND", reason: "no_match" };

  return {
    status: "FOUND",
    googlePlaceId: String(place.id),
    googleMapsUri: typeof place.googleMapsUri === "string" ? place.googleMapsUri : null,
    googleFormattedAddress: typeof place.formattedAddress === "string" ? place.formattedAddress : null,
  };
}

export async function resolveVenueLocation(
  venue: FoursquareVenue,
  context: GooglePlacesContext = {}
): Promise<VenueLocationResult> {
  const fallback = formatVenueLocation(venue);
  if (!venue.id) return { location: fallback, source: "foursquare", skippedReason: "missing_venue_id" };

  const cached = await db.venueEnrichment.findUnique({ where: { foursquareVenueId: venue.id } });
  if (cached?.googleFormattedAddress) {
    await recordGooglePlacesCacheHit(venue.id);
    return { location: `${venue.name}, ${cached.googleFormattedAddress}`, source: "google" };
  }
  if (
    cached?.googleFetchedAt &&
    ["FAILED", "NOT_FOUND"].includes(cached.googleLookupStatus) &&
    Date.now() - cached.googleFetchedAt.getTime() < FAILED_LOOKUP_RETRY_MS
  ) {
    return { location: fallback, source: "foursquare", skippedReason: cached.googleLookupStatus.toLowerCase() };
  }

  const snapshot = snapshotVenue(venue);
  await db.venueEnrichment.upsert({
    where: { foursquareVenueId: venue.id },
    update: snapshot,
    create: { foursquareVenueId: venue.id, ...snapshot },
  });

  try {
    const result = await searchGooglePlace(venue, context);
    if (result.status === "FOUND") {
      await db.venueEnrichment.update({
        where: { foursquareVenueId: venue.id },
        data: {
          ...snapshot,
          googlePlaceId: result.googlePlaceId,
          googleMapsUri: result.googleMapsUri,
          googleFormattedAddress: result.googleFormattedAddress,
          googleLookupStatus: "FOUND",
          googleError: null,
          googleFetchedAt: new Date(),
        },
      });
      if (result.googleFormattedAddress) {
        return { location: `${venue.name}, ${result.googleFormattedAddress}`, source: "google" };
      }
      return { location: fallback, source: "foursquare", skippedReason: "google_missing_address" };
    }

    await db.venueEnrichment.update({
      where: { foursquareVenueId: venue.id },
      data: {
        ...snapshot,
        googleLookupStatus: result.status,
        googleError: result.reason,
        googleFetchedAt: result.status === "SKIPPED" ? null : new Date(),
      },
    });
    if (result.reason === "backfill_cap_no_fallback") {
      throw new Error("google places manual limit reached");
    }
    return { location: fallback, source: "foursquare", skippedReason: result.reason };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await db.venueEnrichment.update({
      where: { foursquareVenueId: venue.id },
      data: {
        ...snapshot,
        googleLookupStatus: "FAILED",
        googleError: message.slice(0, 500),
        googleFetchedAt: new Date(),
      },
    });
    return { location: fallback, source: "foursquare", skippedReason: "google_error" };
  }
}

export function getUniqueVenueIds(venues: FoursquareVenue[]): string[] {
  return Array.from(new Set(venues.map((venue) => venue.id).filter(Boolean)));
}
