import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { normalizeBaseUrl } from "@/lib/url";

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");
  const baseUrl = normalizeBaseUrl(process.env.NEXTAUTH_URL, req.nextUrl.origin);

  const params = new URLSearchParams({
    client_id: process.env.FOURSQUARE_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: `${baseUrl}/api/auth/foursquare/callback`,
    state,
  });

  const res = NextResponse.redirect(
    `https://foursquare.com/oauth2/authenticate?${params}`
  );

  // store state in a short-lived cookie for verification on callback
  res.cookies.set("fsq-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return res;
}
