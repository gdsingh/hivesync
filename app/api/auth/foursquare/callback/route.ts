import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { normalizeBaseUrl } from "@/lib/url";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("fsq-state")?.value;
  const baseUrl = normalizeBaseUrl(process.env.NEXTAUTH_URL, req.nextUrl.origin);

  // csrf check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/?error=foursquare_state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=foursquare_no_code`);
  }

  // exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: process.env.FOURSQUARE_CLIENT_ID ?? "",
    client_secret: process.env.FOURSQUARE_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    redirect_uri: `${baseUrl}/api/auth/foursquare/callback`,
    code,
  });

  const tokenRes = await fetch(
    `https://foursquare.com/oauth2/access_token?${tokenParams}`
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/?error=foursquare_token_failed`);
  }

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;

  // fetch user profile
  const profileRes = await fetch(
    `https://api.foursquare.com/v2/users/self?oauth_token=${accessToken}&v=20240101`
  );

  let displayName: string | null = null;
  let userId: string | null = null;
  let photoUrl: string | null = null;

  if (profileRes.ok) {
    const profileData = await profileRes.json();
    const user = profileData?.response?.user;
    if (user) {
      userId = user.id ?? null;
      displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
      if (user.photo?.prefix && user.photo?.suffix) {
        photoUrl = `${user.photo.prefix}300x300${user.photo.suffix}`;
      }
    }
  }

  // upsert into UserConfig (single row, always id=1)
  await db.userConfig.upsert({
    where: { id: 1 },
    update: {
      foursquareToken: encrypt(accessToken),
      foursquareUserId: userId,
      foursquareDisplayName: displayName,
      foursquarePhotoUrl: photoUrl,
    },
    create: {
      id: 1,
      foursquareToken: encrypt(accessToken),
      foursquareUserId: userId,
      foursquareDisplayName: displayName,
      foursquarePhotoUrl: photoUrl,
    },
  });

  const res = NextResponse.redirect(`${baseUrl}/home`);
  res.cookies.delete("fsq-state");
  return res;
}
