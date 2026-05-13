import { google, calendar_v3 } from "googleapis";
import { find as geoFind } from "geo-tz";
import { db } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";
import { GooglePlacesContext, resolveVenueLocation } from "@/lib/google-places";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FoursquareVenue {
  id: string;
  name: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    formattedAddress?: string[];
    lat?: number;
    lng?: number;
  };
  categories?: Array<{ name: string; primary?: boolean }>;
  timeZone?: string;
}

export interface FoursquareUser {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface FoursquareCheckin {
  id: string;
  createdAt: number; // unix timestamp
  shout?: string;
  venue?: FoursquareVenue;
  score?: {
    total?: number;
    scores?: Array<{ message: string; points?: number }>;
  };
  with?: FoursquareUser[];
  overlaps?: {
    count?: number;
    items?: Array<{ user?: FoursquareUser }>;
  };
  likes?: {
    count: number;
    groups?: Array<{
      items?: FoursquareUser[];
    }>;
  };
  isMayor?: boolean;
  sticker?: {
    id: string;
    name: string;
    image: { prefix: string; sizes: number[]; name: string };
  };
  stickerPowerup?: {
    bonusType?: string;
    value?: number;
    title?: string;
    showUpgradeLink?: boolean;
  };
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

export interface FoursquareSticker {
  id: string;
  name: string;
  image: { prefix: string; name: string };
  group?: { name: string };
  unlockText?: string;
  teaseText?: string;
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

export async function getCalendarName(): Promise<string> {
  const config = await db.userConfig.findUnique({ where: { id: 1 } });
  const base = config?.ogMode ? "Foursquare" : "Swarm";
  return process.env.NODE_ENV === "development" ? `${base} (dev)` : base;
}

// ---------------------------------------------------------------------------
// Google auth
// ---------------------------------------------------------------------------

export async function getGoogleAuth() {
  const userConfig = await db.userConfig.findUnique({ where: { id: 1 } });
  if (!userConfig?.googleCredentialsJson) {
    throw new Error("google not connected");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials(JSON.parse(decrypt(userConfig.googleCredentialsJson)));

  // persist refreshed tokens back to db whenever they rotate
  oauth2Client.on("tokens", async (newTokens) => {
    const current = await db.userConfig.findUnique({ where: { id: 1 } });
    if (current?.googleCredentialsJson) {
      const merged = {
        ...JSON.parse(decrypt(current.googleCredentialsJson)),
        ...newTokens,
      };
      await db.userConfig.update({
        where: { id: 1 },
        data: { googleCredentialsJson: encrypt(JSON.stringify(merged)) },
      });
    }
  });

  return oauth2Client;
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

// finds or creates the sync calendar; returns its id
export async function ensureSwarmCalendar(
  calendarService: calendar_v3.Calendar
): Promise<string> {
  const name = await getCalendarName();
  const list = await calendarService.calendarList.list();
  const existing = list.data.items?.find((c) => c.summary === name);
  if (existing?.id) return existing.id;

  const created = await calendarService.calendars.insert({
    requestBody: { summary: name },
  });
  return created.data.id!;
}

// ---------------------------------------------------------------------------
// Event formatting
// ---------------------------------------------------------------------------

export function getVenueTimezone(venue: FoursquareVenue): string {
  if (venue.timeZone) return venue.timeZone;

  const lat = venue.location?.lat;
  const lng = venue.location?.lng;
  if (lat != null && lng != null) {
    const zones = geoFind(lat, lng);
    if (zones.length > 0) return zones[0];
  }

  return "UTC";
}

export function formatEventDescription(checkin: FoursquareCheckin): string {
  const parts: string[] = [];

  if (checkin.shout) {
    parts.push(`💬 ${checkin.shout}`);
  }

  if (checkin.score?.scores?.length) {
    const scores = checkin.score.scores;
    const bullets = scores.length === 1
      ? `${scores[0].message}${scores[0].points != null ? ` (+${scores[0].points})` : ""}`
      : scores.map((s) => `• ${s.message}${s.points != null ? ` (+${s.points})` : ""}`).join("\n");

    const coinsPart = checkin.score.total != null ? `💰 ${checkin.score.total} coins` : null;
    const stickerBonus = checkin.stickerPowerup?.title
      ? `🎫 ${checkin.stickerPowerup.title}`
      : checkin.stickerPowerup?.value != null
      ? `🎫 ${checkin.stickerPowerup.value}x sticker bonus`
      : null;
    const coinLine = [coinsPart, stickerBonus].filter(Boolean).join(" · ");

    parts.push(coinLine ? `${bullets}\n\n${coinLine}` : bullets);
  }

  // collect friend names from tagged friends + overlapping check-ins (deduped, sorted)
  const friendNames: string[] = [];

  if (checkin.with?.length) {
    for (const user of checkin.with) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (name) friendNames.push(name);
    }
  }

  if (checkin.overlaps?.items?.length) {
    for (const overlap of checkin.overlaps.items) {
      if (overlap.user) {
        const name = [overlap.user.firstName, overlap.user.lastName]
          .filter(Boolean)
          .join(" ");
        if (name) friendNames.push(name);
      }
    }
  }

  if (friendNames.length) {
    const sorted = Array.from(new Set(friendNames)).sort();
    parts.push(`👥 with ${sorted.join(", ")}`);
  }

  if (checkin.likes && checkin.likes.count > 0) {
    const likerNames: string[] = [];
    for (const group of checkin.likes.groups ?? []) {
      for (const user of group.items ?? []) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
        if (name) likerNames.push(name);
      }
    }
    if (likerNames.length) {
      parts.push(`❤️ liked by ${likerNames.join(", ")}`);
    } else {
      parts.push(`❤️ ${checkin.likes.count} like${checkin.likes.count !== 1 ? "s" : ""}`);
    }
  }

  if (checkin.venue?.id) {
    parts.push(`https://foursquare.com/v/${checkin.venue.id}`);
  }

  return parts.join("\n\n");
}

export function formatEventLocation(venue: FoursquareVenue): string {
  const loc = venue.location;
  if (!loc) return venue.name;

  // build address from parts if formattedAddress not available
  const address =
    loc.formattedAddress?.join(", ") ??
    [loc.address, loc.city, loc.state, loc.postalCode, loc.country]
      .filter(Boolean)
      .join(", ");

  return address ? `${venue.name}, ${address}` : venue.name;
}

// ---------------------------------------------------------------------------
// Foursquare API
// ---------------------------------------------------------------------------

export async function fetchCheckins(
  token: string,
  offset: number,
  afterTimestamp?: number,
  limit = 250,
  beforeTimestamp?: number
): Promise<{ items: FoursquareCheckin[]; total: number }> {
  const params = new URLSearchParams({
    oauth_token: token,
    v: "20240101",
    limit: String(limit),
    offset: String(offset),
    ...(afterTimestamp ? { afterTimestamp: String(afterTimestamp) } : {}),
    ...(beforeTimestamp ? { beforeTimestamp: String(beforeTimestamp) } : {}),
  });

  const res = await fetch(
    `https://api.foursquare.com/v2/users/self/checkins?${params}`
  );

  if (!res.ok) {
    throw new Error(`foursquare checkins fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const checkins = data?.response?.checkins;
  return {
    items: checkins?.items ?? [],
    total: checkins?.count ?? 0,
  };
}

export async function fetchStickers(token: string): Promise<FoursquareSticker[]> {
  const params = new URLSearchParams({ oauth_token: token, v: "20240101" });
  const res = await fetch(`https://api.foursquare.com/v2/users/self/stickers?${params}`);
  if (!res.ok) throw new Error(`foursquare stickers fetch failed: ${res.status}`);
  const data = await res.json();
  const stickers = data?.response?.stickers;
  // API returns either { items: [...] } or a flat array
  return Array.isArray(stickers) ? stickers : (stickers?.items ?? []);
}

export async function fetchCheckinDetail(
  token: string,
  checkinId: string
): Promise<FoursquareCheckin> {
  const params = new URLSearchParams({ oauth_token: token, v: "20240101" });
  const res = await fetch(
    `https://api.foursquare.com/v2/checkins/${checkinId}?${params}`
  );
  if (!res.ok) throw new Error(`foursquare checkin detail failed: ${res.status}`);
  const data = await res.json();
  return data?.response?.checkin;
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------

export async function syncCheckins(
  checkins: FoursquareCheckin[],
  calendarService: calendar_v3.Calendar,
  calendarId: string,
  foursquareToken?: string,
  googlePlacesContext: GooglePlacesContext = {}
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };

  if (checkins.length === 0) return result;

  // dedup: find which ids are already synced
  const ids = checkins.map((c) => c.id);
  const existing = await db.syncedCheckin.findMany({
    where: { checkinId: { in: ids } },
    select: { checkinId: true },
  });
  const existingIds = new Set(existing.map((e) => e.checkinId));

  for (const checkin of checkins) {
    if (existingIds.has(checkin.id)) {
      result.skipped++;
      continue;
    }

    try {
      // fetch full detail to get shout, score, overlaps, likes
      let fullCheckin = checkin;
      if (foursquareToken) {
        try {
          fullCheckin = await fetchCheckinDetail(foursquareToken, checkin.id);
        } catch {
          // fall back to list data if detail fetch fails
        }
      }

      const { id: eventId, htmlLink: calendarEventUrl } = await createCalendarEvent(
        fullCheckin,
        calendarService,
        calendarId,
        googlePlacesContext
      );
      const loc = checkin.venue?.location;
      const venueCity = loc
        ? [loc.city, loc.state ?? loc.country].filter(Boolean).join(", ") || null
        : null;
      const venueCategory =
        fullCheckin.venue?.categories?.find((c) => c.primary)?.name ??
        fullCheckin.venue?.categories?.[0]?.name ??
        null;
      const stickerImg = fullCheckin.sticker?.image;
      const stickerImageUrl = stickerImg
        ? `${stickerImg.prefix}300${stickerImg.name}`
        : null;

      await db.syncedCheckin.create({
        data: {
          checkinId: checkin.id,
          calendarEventId: eventId,
          calendarEventUrl: calendarEventUrl ?? null,
          venueId: checkin.venue?.id ?? null,
          venueName: checkin.venue?.name ?? null,
          venueCity,
          venueCategory,
          checkinTimestamp: checkin.createdAt,
          isMayor: fullCheckin.isMayor ?? false,
          description: formatEventDescription(fullCheckin),
          stickerImageUrl,
        },
      });
      result.synced++;
    } catch (err) {
      console.error(`failed to sync checkin ${checkin.id}:`, err);
      result.errors++;
    }
  }

  return result;
}

async function createCalendarEvent(
  checkin: FoursquareCheckin,
  calendarService: calendar_v3.Calendar,
  calendarId: string,
  googlePlacesContext: GooglePlacesContext
): Promise<{ id: string; htmlLink: string | null | undefined }> {
  const venue = checkin.venue;
  const timezone = venue ? getVenueTimezone(venue) : "UTC";

  const startMs = checkin.createdAt * 1000;
  const endMs = startMs + 15 * 60 * 1000; // +15 min

  const toRfc3339 = (ms: number, tz: string) => {
    // format as local time in the venue's timezone
    const date = new Date(ms);
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    // sv-SE gives YYYY-MM-DD HH:MM:SS — convert to RFC3339 local
    return formatter.format(date).replace(" ", "T");
  };

  const eventBody: calendar_v3.Schema$Event = {
    summary: checkin.isMayor ? `${venue?.name ?? "Swarm check-in"} 👑` : (venue?.name ?? "Swarm check-in"),
    description: formatEventDescription(checkin),
    location: venue ? formatEventLocation(venue) : undefined,
    start: {
      dateTime: toRfc3339(startMs, timezone),
      timeZone: timezone,
    },
    end: {
      dateTime: toRfc3339(endMs, timezone),
      timeZone: timezone,
    },
  };

  if (venue) {
    const resolvedLocation = await resolveVenueLocation(venue, googlePlacesContext);
    eventBody.location = resolvedLocation.location;
  }


  const created = await calendarService.events.insert({
    calendarId,
    requestBody: eventBody,
  });

  return { id: created.data.id!, htmlLink: created.data.htmlLink };
}
