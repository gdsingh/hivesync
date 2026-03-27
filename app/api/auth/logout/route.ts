import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(`${baseUrl}/login`);
  res.cookies.delete(COOKIE_NAME);
  return res;
}
