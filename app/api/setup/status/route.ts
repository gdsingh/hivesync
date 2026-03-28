import { NextRequest, NextResponse } from "next/server";

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

// in-memory rate limiter: max 20 requests per IP per minute
const requests = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  // if already configured, return minimal response — no need to expose var names
  const allSet = REQUIRED_VARS.every((v) => !!process.env[v]);
  if (allSet) {
    return NextResponse.json({ configured: true });
  }

  const vars = Object.fromEntries(
    REQUIRED_VARS.map((name) => [name, !!process.env[name]])
  );

  const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

  return NextResponse.json({ vars, appUrl });
}
