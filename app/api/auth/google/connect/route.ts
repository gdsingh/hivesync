import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");
  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/google/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return refresh token
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state,
  });

  const res = NextResponse.redirect(authUrl);

  res.cookies.set("google-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return res;
}
