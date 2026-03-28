import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// vars that should be encrypted in Vercel (secrets)
const ENCRYPTED_VARS = new Set([
  "NEXTAUTH_SECRET",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
  "FOURSQUARE_CLIENT_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
]);

const REQUIRED_VARS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ALLOWED_GOOGLE_EMAIL",
  "ENCRYPTION_KEY",
  "FOURSQUARE_CLIENT_ID",
  "FOURSQUARE_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
];

// in-memory rate limiter: max 5 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

function isAlreadyConfigured(): boolean {
  return REQUIRED_VARS.every((v) => !!process.env[v]);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidString(val: unknown, maxLen = 512): val is string {
  return typeof val === "string" && val.length > 0 && val.length <= maxLen;
}

export async function POST(req: NextRequest) {
  // self-disable: if already configured, refuse
  if (isAlreadyConfigured()) {
    return NextResponse.json({ error: "already configured" }, { status: 403 });
  }

  // rate limit by IP
  const ip = getIp(req);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: `too many attempts — try again in ${retryAfter}s` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const {
    mode,
    vercelToken,
    allowedEmail,
    foursquareClientId,
    foursquareClientSecret,
    googleClientId,
    googleClientSecret,
    databaseUrl,
    directUrl,
    googleMapsApiKey,
    appUrl: bodyAppUrl,
    customDomain: bodyCustomDomain,
  } = body as Record<string, unknown>;

  // validate all required fields
  if (!isValidEmail(String(allowedEmail ?? ""))) {
    return NextResponse.json({ error: "invalid email address" }, { status: 400 });
  }
  if (!isValidString(foursquareClientId) || !isValidString(foursquareClientSecret) ||
      !isValidString(googleClientId) || !isValidString(googleClientSecret)) {
    return NextResponse.json({ error: "missing or invalid oauth credentials" }, { status: 400 });
  }
  if (!isValidString(databaseUrl, 2048) || !isValidString(directUrl, 2048)) {
    return NextResponse.json({ error: "missing or invalid database urls" }, { status: 400 });
  }
  if (googleMapsApiKey !== undefined && googleMapsApiKey !== "" && !isValidString(googleMapsApiKey)) {
    return NextResponse.json({ error: "invalid google maps api key" }, { status: 400 });
  }

  // generate secrets server-side
  const nextauthSecret = crypto.randomBytes(32).toString("base64");
  const encryptionKey = crypto.randomBytes(32).toString("base64");
  const cronSecret = crypto.randomBytes(32).toString("base64");

  // self-hosted mode: return a .env block for the user to copy
  if (mode === "selfhosted") {
    const appUrl = isValidUrl(String(bodyAppUrl ?? "")) ? String(bodyAppUrl) : "";
    const lines = [
      `NEXTAUTH_SECRET=${nextauthSecret}`,
      `NEXTAUTH_URL=${appUrl}`,
      `ALLOWED_GOOGLE_EMAIL=${allowedEmail}`,
      `ENCRYPTION_KEY=${encryptionKey}`,
      `FOURSQUARE_CLIENT_ID=${foursquareClientId}`,
      `FOURSQUARE_CLIENT_SECRET=${foursquareClientSecret}`,
      `GOOGLE_CLIENT_ID=${googleClientId}`,
      `GOOGLE_CLIENT_SECRET=${googleClientSecret}`,
      `CRON_SECRET=${cronSecret}`,
      `DATABASE_URL=${databaseUrl}`,
      `DIRECT_URL=${directUrl}`,
      ...(googleMapsApiKey ? [`GOOGLE_MAPS_API_KEY=${googleMapsApiKey}`] : []),
    ];
    return NextResponse.json({ envBlock: lines.join("\n") });
  }

  // vercel mode: push vars via api
  if (!isValidString(vercelToken as string)) {
    return NextResponse.json({ error: "vercelToken required" }, { status: 400 });
  }

  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "VERCEL_PROJECT_ID not available — are you running on Vercel?" }, { status: 400 });
  }

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  if (!vercelUrl) {
    return NextResponse.json({ error: "VERCEL_URL not available" }, { status: 400 });
  }

  const nextauthUrl =
    isValidUrl(String(bodyCustomDomain ?? "")) ? String(bodyCustomDomain) : vercelUrl;

  const envVars: Record<string, string> = {
    NEXTAUTH_SECRET: nextauthSecret,
    NEXTAUTH_URL: nextauthUrl,
    ALLOWED_GOOGLE_EMAIL: String(allowedEmail),
    ENCRYPTION_KEY: encryptionKey,
    FOURSQUARE_CLIENT_ID: String(foursquareClientId),
    FOURSQUARE_CLIENT_SECRET: String(foursquareClientSecret),
    GOOGLE_CLIENT_ID: String(googleClientId),
    GOOGLE_CLIENT_SECRET: String(googleClientSecret),
    CRON_SECRET: cronSecret,
    DATABASE_URL: String(databaseUrl),
    DIRECT_URL: String(directUrl),
    ...(googleMapsApiKey ? { GOOGLE_MAPS_API_KEY: String(googleMapsApiKey) } : {}),
  };

  // push each var to Vercel API
  for (const [key, value] of Object.entries(envVars)) {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          value,
          type: ENCRYPTED_VARS.has(key) ? "encrypted" : "plain",
          target: ["production"],
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // ignore conflict errors — var already exists
      if (res.status !== 409) {
        const message = data?.error?.message ?? `failed to set ${key} (${res.status})`;
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  // trigger a redeploy
  let redeployUrl: string | null = null;
  try {
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    if (deploymentsRes.ok) {
      const deploymentsData = await deploymentsRes.json();
      const latest = deploymentsData?.deployments?.[0];
      if (latest?.uid) {
        const redeployRes = await fetch(
          `https://api.vercel.com/v13/deployments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deploymentId: latest.uid,
              name: latest.name,
              target: "production",
            }),
          }
        );
        if (redeployRes.ok) {
          const redeployData = await redeployRes.json();
          redeployUrl = redeployData?.url ? `https://${redeployData.url}` : null;
        }
      }
    }
  } catch {
    // redeploy is best-effort
  }

  return NextResponse.json({ ok: true, redeployUrl });
}
