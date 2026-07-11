import { describe, expect, it } from "vitest";

import { shouldSkipGeminiAnalysis, subjectClearlyNotKhReferral, threadHasNoAnalyzableContent } from "./client";

describe("subjectClearlyNotKhReferral", () => {
  it("skips subjects without KH context", () => {
    expect(subjectClearlyNotKhReferral("Monthly operations update")).toBe(true);
    expect(subjectClearlyNotKhReferral(undefined)).toBe(true);
  });

  it("keeps referral subjects", () => {
    expect(subjectClearlyNotKhReferral("KH Referral Incentive - Patient A")).toBe(false);
    expect(subjectClearlyNotKhReferral("KHOPS incentive request")).toBe(false);
  });

  it("skips payment-only KH subjects", () => {
    expect(subjectClearlyNotKhReferral("KH payment confirmation")).toBe(true);
  });

  it("skips KH threads without referral-specific subject signals", () => {
    expect(subjectClearlyNotKhReferral("KH manager approval pending")).toBe(true);
    expect(subjectClearlyNotKhReferral("KH update")).toBe(true);
  });
});

describe("threadHasNoAnalyzableContent", () => {
  it("skips empty threads without attachments", () => {
    expect(
      threadHasNoAnalyzableContent({
        messages: [{ bodyText: "   ", attachments: [] }],
      }),
    ).toBe(true);
  });

  it("keeps threads with referral body or attachments", () => {
    expect(
      threadHasNoAnalyzableContent({
        messages: [{ bodyText: "Referral incentive for patient", attachments: [] }],
      }),
    ).toBe(false);
    expect(
      threadHasNoAnalyzableContent({
        messages: [{ bodyText: "", attachments: [{ mimeType: "application/pdf" }] }],
      }),
    ).toBe(false);
  });
});

describe("shouldSkipGeminiAnalysis", () => {
  it("skips when the Gmail thread already exists", () => {
    const result = shouldSkipGeminiAnalysis({
      threadExistsInDatabase: true,
      subject: "KH Referral Incentive",
      thread: { messages: [{ bodyText: "Referral details", attachments: [] }] },
    });
    expect(result.skip).toBe(true);
  });

  it("allows first-time referral threads with content", () => {
    const result = shouldSkipGeminiAnalysis({
      threadExistsInDatabase: false,
      subject: "KH Referral Incentive",
      thread: { messages: [{ bodyText: "Referral details", attachments: [] }] },
    });
    expect(result.skip).toBe(false);
  });
});
