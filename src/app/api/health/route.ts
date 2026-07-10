import { NextResponse } from "next/server";

import { prisma } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok" }); }
  catch { return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 }); }
}
