import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/prisma";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/encrypt";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("google-state")?.value;
  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  // csrf check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/login?error=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/google/callback`
  );

  let tokens;
  try {
    const tokenResponse = await oauth2Client.getToken(code);
    tokens = tokenResponse.tokens;
  } catch {
    return NextResponse.redirect(`${baseUrl}/login?error=token_failed`);
  }

  oauth2Client.setCredentials(tokens);

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

  // fetch the user's email + photo
  let googleEmail: string | null = null;
  let googlePhotoUrl: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    googleEmail = userInfo.data.email ?? null;
    googlePhotoUrl = userInfo.data.picture ?? null;
  } catch {
    // non-fatal
  }

  // if ALLOWED_GOOGLE_EMAIL is set, reject any account that doesn't match —
  // prevents anyone from claiming the deployment before the owner signs in
  const allowedEmail = process.env.ALLOWED_GOOGLE_EMAIL;
  if (allowedEmail && googleEmail !== allowedEmail) {
    return NextResponse.redirect(`${baseUrl}/login?error=wrong_account`);
  }

  // single-user ownership: first account to connect becomes the owner.
  // subsequent sign-ins must use the same google account.
  const existing = await db.userConfig.findUnique({ where: { id: 1 } });
  if (existing?.googleEmail && googleEmail && existing.googleEmail !== googleEmail) {
    return NextResponse.redirect(`${baseUrl}/login?error=wrong_account`);
  }

  await db.userConfig.upsert({
    where: { id: 1 },
    update: {
      googleCredentialsJson: encrypt(JSON.stringify(tokens)),
      googleEmail,
      googlePhotoUrl,
    },
    create: {
      id: 1,
      googleCredentialsJson: encrypt(JSON.stringify(tokens)),
      googleEmail,
      googlePhotoUrl,
    },
  });

  // issue the app session cookie — signing in with Google = authenticated
  const sessionToken = createSessionToken();
  const res = NextResponse.redirect(`${baseUrl}/home`);

  res.cookies.delete("google-state");
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // strict blocks the cookie on OAuth redirect chains (cross-site navigation context)
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
