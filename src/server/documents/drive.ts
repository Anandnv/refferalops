import { Readable } from "node:stream";

import { getAuthenticatedGoogleClients } from "@/server/gmail/client";
import { getGeneralSettings } from "@/server/settings/service";

export async function archiveInDrive(input: { filename: string; mimeType: string; buffer: Buffer; folderId?: string }) {
  const settings = await getGeneralSettings();
  const folderId = input.folderId || settings.driveFolderId;
  if (!folderId) throw new Error("Set a Google Drive folder ID before saving files.");
  const { drive } = await getAuthenticatedGoogleClients();
  const response = await drive.files.create({
    requestBody: { name: input.filename, parents: [folderId] },
    media: { mimeType: input.mimeType, body: Readable.from(input.buffer) },
    fields: "id",
  });
  if (!response.data.id) throw new Error("Google Drive did not return a file ID.");
  return response.data.id;
}

export async function downloadFromDrive(fileId: string) {
  const { drive } = await getAuthenticatedGoogleClients();
  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(response.data as ArrayBuffer);
}
