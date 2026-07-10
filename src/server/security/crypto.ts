import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKey() {
  const configuredKey = process.env.APP_ENCRYPTION_KEY;
  if (!configuredKey) {
    throw new Error("APP_ENCRYPTION_KEY must be configured before saving secrets.");
  }

  const decoded = Buffer.from(configuredKey, "base64");
  return decoded.length === 32 ? decoded : createHash("sha256").update(configuredKey).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string) {
  const decoded = Buffer.from(payload, "base64");
  const iv = decoded.subarray(0, IV_LENGTH);
  const authTag = decoded.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = decoded.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
