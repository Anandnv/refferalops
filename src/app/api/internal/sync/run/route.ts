import { NextRequest, NextResponse } from "next/server";

import { runReferralSync } from "@/server/ingestion/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runReferralSync({ trigger: "CRON" })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Scheduled sync failed." }, { status: 500 }); }
}
