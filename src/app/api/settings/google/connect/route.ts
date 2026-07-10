import { NextResponse } from "next/server";

import { createGoogleAuthorizationUrl } from "@/server/gmail/client";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.redirect(await createGoogleAuthorizationUrl()); }
  catch (error) { return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Google connection failed")}`, process.env.NEXT_PUBLIC_APP_URL)); }
}
