import { RequestStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { detectRuleStatus, mostAdvancedStatus } from "./rules";

describe("approval status rules", () => {
  it("recognizes a finance handoff", () => {
    expect(detectRuleStatus("Referral approval", "The approved request was forwarded to finance for payment.")?.status).toBe(RequestStatus.SENT_TO_FINANCE);
  });

  it("prefers paid as the most advanced status", () => {
    expect(mostAdvancedStatus([RequestStatus.RECEIVED, RequestStatus.MANAGER_APPROVED, RequestStatus.PAID])).toBe(RequestStatus.PAID);
  });
});
