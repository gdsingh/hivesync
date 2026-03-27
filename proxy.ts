import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

// paths that don't require an app session
const PUBLIC_PREFIXES = [
  "/login",
  "/demo",
  "/api/auth/google/connect",
  "/api/auth/google/callback",
  "/api/auth/foursquare/callback",
  "/api/health",
  "/api/sync/poll",
  "/_next",
  "/icon",
];

function buildCsp(): string {
  return [
    "default-src 'self'",
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" // webpack HMR requires unsafe-eval in dev
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'", // required by tailwind/shadcn
    "img-src 'self' https://lh3.googleusercontent.com https://*.foursquare.com https://*.4sqi.net https://maps.googleapis.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const csp = buildCsp();
  const { pathname } = request.nextUrl;

  // public routes: completely transparent pass-through — any header modification
  // on NextResponse.next() (even non-cookie headers) can cause next.js to drop
  // Set-Cookie headers from route handler responses (e.g. oauth callback sets
  // the session cookie on a redirect). public routes have no inline scripts so
  // nonce-based CSP is unnecessary; next.config.mjs static headers cover them.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || !(await verifySessionToken(token))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
