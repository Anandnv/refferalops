import { NextRequest, NextResponse } from "next/server";

import { completeGoogleAuthorization } from "@/server/gmail/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?error=Missing+Google+authorization+code", request.url));
  try { await completeGoogleAuthorization(code); return NextResponse.redirect(new URL("/settings?oauth=connected", request.url)); }
  catch (error) { return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Google authorization failed")}`, request.url)); }
}
