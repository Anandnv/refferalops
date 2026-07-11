import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/client";
import { decryptSecret, encryptSecret } from "@/server/security/crypto";

const GENERAL_SETTINGS_KEY = "general";
const GOOGLE_CREDENTIALS_KEY = "google_credentials";
const OPENAI_CREDENTIALS_KEY = "openai_credentials";

const generalSettingsSchema = z.object({
  monitoredEmail: z.string().email().default("team98foperations@gmail.com"),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(10),
  initialSyncDays: z.number().int().min(1).max(3650).default(365),
  openAiModel: z.string().min(1).default("gemini-2.5-flash"),
  driveFolderId: z.string().trim().optional().default(""),
  exportDriveFolderId: z.string().trim().optional().default(""),
  exportTemplateDriveFileId: z.string().trim().optional().default(""),
  exportFolderName: z.string().trim().min(1).default("KHOPS Referral Tracker Exports"),
  confidenceThreshold: z.number().min(0).max(1).default(0.85),
});

const googleCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().optional(),
});

const openAiCredentialsSchema = z.object({
  apiKey: z.string().min(1),
});

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type GoogleCredentials = z.infer<typeof googleCredentialsSchema>;

const defaults = generalSettingsSchema.parse({});

async function readSetting(key: string) {
  return prisma.setting.findUnique({ where: { key } });
}

async function upsertJsonSetting(key: string, value: unknown) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, isSecret: false },
    update: { value: value as Prisma.InputJsonValue, isSecret: false },
  });
}

async function upsertSecretSetting(key: string, value: unknown) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, encryptedValue: encryptSecret(JSON.stringify(value)), isSecret: true },
    update: { encryptedValue: encryptSecret(JSON.stringify(value)), isSecret: true },
  });
}

async function readSecretSetting<T>(key: string, schema: z.ZodType<T>) {
  const setting = await readSetting(key);
  if (!setting?.encryptedValue) return null;

  return schema.parse(JSON.parse(decryptSecret(setting.encryptedValue)));
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const setting = await readSetting(GENERAL_SETTINGS_KEY);
  if (!setting?.value) return defaults;

  const persisted = typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value : {};
  return generalSettingsSchema.parse({ ...defaults, ...persisted });
}

export async function saveGeneralSettings(input: unknown) {
  const settings = generalSettingsSchema.parse(input);
  await upsertJsonSetting(GENERAL_SETTINGS_KEY, settings);
  return settings;
}

export async function getGoogleCredentials() {
  const stored = await readSecretSetting(GOOGLE_CREDENTIALS_KEY, googleCredentialsSchema);
  if (stored) return stored;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return { clientId, clientSecret, refreshToken: process.env.GOOGLE_REFRESH_TOKEN };
}

export async function saveGoogleCredentials(input: { clientId: string; clientSecret: string; refreshToken?: string }) {
  const existing = await getGoogleCredentials();
  const credentials = googleCredentialsSchema.parse({
    clientId: input.clientId || existing?.clientId,
    clientSecret: input.clientSecret || existing?.clientSecret,
    refreshToken: input.refreshToken || existing?.refreshToken,
  });
  await upsertSecretSetting(GOOGLE_CREDENTIALS_KEY, credentials);
}

export async function saveGoogleRefreshToken(refreshToken: string) {
  const credentials = await getGoogleCredentials();
  if (!credentials) throw new Error("Save Google OAuth client credentials before connecting Gmail.");
  await upsertSecretSetting(GOOGLE_CREDENTIALS_KEY, { ...credentials, refreshToken });
}

export async function getOpenAiApiKey() {
  const stored = await readSecretSetting(OPENAI_CREDENTIALS_KEY, openAiCredentialsSchema);
  return stored?.apiKey ?? process.env.GEMINI_API_KEY ?? null;
}

export async function saveOpenAiApiKey(apiKey: string) {
  await upsertSecretSetting(OPENAI_CREDENTIALS_KEY, openAiCredentialsSchema.parse({ apiKey }));
}

export async function getSettingsStatus() {
  const [general, google, openAiKey] = await Promise.all([getGeneralSettings(), getGoogleCredentials(), getOpenAiApiKey()]);
  return {
    general,
    hasGoogleClient: Boolean(google?.clientId && google?.clientSecret),
    hasGoogleRefreshToken: Boolean(google?.refreshToken),
    hasOpenAiApiKey: Boolean(openAiKey),
  };
}
