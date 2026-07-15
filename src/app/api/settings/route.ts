import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { saveGeneralSettings, saveGoogleCredentials, saveOpenAiApiKey } from "@/server/settings/service";

export const runtime = "nodejs";

const payloadSchema = z.object({
  monitoredEmail: z.string().email(), syncIntervalMinutes: z.coerce.number().int().min(5).max(1440), initialSyncDays: z.coerce.number().int().min(1).max(3650), confidenceThreshold: z.coerce.number().min(0).max(1), openAiModel: z.string().min(1), exportDriveFolderId: z.string().optional(), exportTemplateDriveFileId: z.string().optional(), exportFolderName: z.string().optional(), googleClientId: z.string().optional(), googleClientSecret: z.string().optional(), openAiApiKey: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ error: "Use the Settings page to view redacted configuration." }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const input = payloadSchema.parse(await request.json());
    await saveGeneralSettings(input);
    if (input.googleClientId || input.googleClientSecret) {
      if (!input.googleClientId || !input.googleClientSecret) return NextResponse.json({ error: "Both Google OAuth client ID and secret are required when changing Google credentials." }, { status: 400 });
      await saveGoogleCredentials({ clientId: input.googleClientId, clientSecret: input.googleClientSecret });
    }
    if (input.openAiApiKey) await saveOpenAiApiKey(input.openAiApiKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save settings." }, { status: 400 });
  }
}
