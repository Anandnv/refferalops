import { NextResponse } from "next/server";

import { runReferralSync } from "@/server/ingestion/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try { return NextResponse.json(await runReferralSync({ trigger: "MANUAL", force: true })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed." }, { status: 500 }); }
}
