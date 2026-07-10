import { NextResponse } from "next/server";

import { downloadFromDrive } from "@/server/documents/drive";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment?.googleDriveFileId) return NextResponse.json({ error: "Attachment is unavailable." }, { status: 404 });
  try {
    const buffer = await downloadFromDrive(attachment.googleDriveFileId);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve attachment." }, { status: 502 });
  }
}
