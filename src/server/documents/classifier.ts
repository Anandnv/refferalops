import { AttachmentType } from "@prisma/client";

export function inferAttachmentType(filename: string, mimeType: string): AttachmentType {
  const source = `${filename} ${mimeType}`.toLowerCase();
  if (source.includes("cathlab") || source.includes("cath lab")) return AttachmentType.CATHLAB_NOTE;
  if (source.includes("ptca")) return AttachmentType.PTCA_NOTE;
  if (source.includes("prescription") || source.includes("rx")) return AttachmentType.PRESCRIPTION;
  if (source.includes("referral")) return AttachmentType.REFERRAL_NOTE;
  return AttachmentType.OTHER;
}

export function canPreview(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}
