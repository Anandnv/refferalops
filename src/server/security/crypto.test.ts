import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

describe("secret encryption", () => {
  beforeEach(() => { process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });

  it("round-trips a secret without preserving plaintext", () => {
    const encrypted = encryptSecret("private-token");
    expect(encrypted).not.toContain("private-token");
    expect(decryptSecret(encrypted)).toBe("private-token");
  });
});
