import { AttachmentType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canPreview, inferAttachmentType } from "./classifier";

describe("attachment classifier", () => {
  it("classifies common referral documents", () => {
    expect(inferAttachmentType("PTCA Note.pdf", "application/pdf")).toBe(AttachmentType.PTCA_NOTE);
    expect(inferAttachmentType("Referral Letter.pdf", "application/pdf")).toBe(AttachmentType.REFERRAL_NOTE);
  });

  it("allows image and PDF previews", () => {
    expect(canPreview("image/jpeg")).toBe(true);
    expect(canPreview("application/pdf")).toBe(true);
    expect(canPreview("text/plain")).toBe(false);
  });
});
