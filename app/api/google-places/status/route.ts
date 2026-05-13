import { NextRequest, NextResponse } from "next/server";
import { getGooglePlacesUsageStatus, updateGooglePlacesLimits } from "@/lib/google-places";

export async function GET() {
  try {
    const status = await getGooglePlacesUsageStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dailyLimit = Number(body.dailyLimit);
    const monthlyLimit = Number(body.monthlyLimit);
    const backfillRunLimit = Number(body.backfillRunLimit);

    if (![dailyLimit, monthlyLimit, backfillRunLimit].every(Number.isFinite)) {
      return NextResponse.json({ error: "valid limits required" }, { status: 400 });
    }

    const status = await updateGooglePlacesLimits({
      dailyLimit,
      monthlyLimit,
      backfillRunLimit,
    });
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "could not update limits" }, { status: 500 });
  }
}
