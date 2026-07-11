import { describe, expect, it } from "vitest";

import { shouldSkipGeminiAnalysis, subjectContainsKh, threadHasGeminiSignals } from "./client";

describe("subjectContainsKh", () => {
  it("detects KH context in the subject", () => {
    expect(subjectContainsKh("KH Referral Incentive - Patient A")).toBe(true);
    expect(subjectContainsKh("KHOPS incentive request")).toBe(true);
  });

  it("ignores subjects without KH context", () => {
    expect(subjectContainsKh("Monthly operations update")).toBe(false);
    expect(subjectContainsKh(undefined)).toBe(false);
  });
});

describe("threadHasGeminiSignals", () => {
  it("returns false for empty threads without allowed signals", () => {
    expect(
      threadHasGeminiSignals({
        messages: [{ bodyText: "   ", attachments: [] }],
      }),
    ).toBe(false);
  });

  it("returns true for referral body keywords", () => {
    expect(
      threadHasGeminiSignals({
        messages: [{ bodyText: "Referral incentive for patient", attachments: [] }],
      }),
    ).toBe(true);
  });

  it("returns true for attachment-only threads", () => {
    expect(
      threadHasGeminiSignals({
        messages: [{ bodyText: "", attachments: [{ mimeType: "application/pdf" }] }],
      }),
    ).toBe(true);
    expect(
      threadHasGeminiSignals({
        messages: [{ bodyText: "", attachments: [{ mimeType: "image/png" }] }],
      }),
    ).toBe(true);
    expect(
      threadHasGeminiSignals({
        messages: [{ bodyText: "", attachments: [{ mimeType: "application/msword" }] }],
      }),
    ).toBe(true);
  });
});

describe("shouldSkipGeminiAnalysis", () => {
  it("allows first-time KH subject threads", () => {
    const result = shouldSkipGeminiAnalysis({
      subject: "KH manager approval pending",
      thread: { messages: [{ bodyText: "", attachments: [] }] },
    });
    expect(result.skip).toBe(false);
  });

  it("allows first-time threads with attachments even without KH subject", () => {
    const result = shouldSkipGeminiAnalysis({
      subject: "Fwd",
      thread: { messages: [{ bodyText: "", attachments: [{ mimeType: "application/pdf" }] }] },
    });
    expect(result.skip).toBe(false);
  });

  it("does not skip merely because the Gmail thread record may already exist", () => {
    const result = shouldSkipGeminiAnalysis({
      subject: "KH Referral Incentive",
      thread: { messages: [{ bodyText: "Referral details", attachments: [] }] },
    });
    expect(result.skip).toBe(false);
  });

  it("skips only when all configured signals are absent", () => {
    const result = shouldSkipGeminiAnalysis({
      subject: "Monthly operations update",
      thread: { messages: [{ bodyText: "Please review", attachments: [] }] },
    });
    expect(result.skip).toBe(true);
  });
});
