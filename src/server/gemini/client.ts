import { GoogleGenAI, type Part } from "@google/genai";

import { getGeneralSettings, getOpenAiApiKey } from "@/server/settings/service";

const DEFAULT_MODEL = "gemini-flash-latest";
const MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-flash-latest",
  "gemini-2.5-flash-lite": "gemini-flash-latest",
};

const REFERRAL_SIGNALS = [
  "referral",
  "incentive",
  "patient",
  "procedure",
  "discharge",
  "beneficiary",
  "khops",
  "centre",
  "center",
  "hospital",
  "payment",
  "doctor",
  "ambulance",
];

export type GeminiContentPart = Part | string;

export function stripMarkdownJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/m, "");
  }
  return cleaned.trim();
}

const BODY_GEMINI_SIGNALS = ["referral", "incentive", "doctor", "ambulance"];

export function subjectContainsKh(subject?: string) {
  const normalized = (subject ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return /\bkh\b|khops/.test(normalized);
}

export function threadHasGeminiSignals(thread: {
  messages: Array<{ bodyText?: string; attachments: Array<{ mimeType: string }> }>;
}) {
  const source = thread.messages[0];
  if (!source) return false;

  const body = (source.bodyText ?? "").toLowerCase();
  const hasBodySignal = BODY_GEMINI_SIGNALS.some((signal) => body.includes(signal));

  return hasBodySignal;
}

export function shouldSkipGeminiAnalysis(input: {
  subject?: string;
  thread: { messages: Array<{ bodyText?: string; attachments: Array<{ mimeType: string }> }> };
}) {
  const hasSignal = subjectContainsKh(input.subject) || threadHasGeminiSignals(input.thread);
  if (!hasSignal) {
    return { skip: true, reason: "Skipped Gemini: no KH/referral signals found in the subject or email body." };
  }
  return { skip: false as const };
}

export function obviouslyNotReferralRequest(input: { bodyText?: string; documents?: unknown[] }) {
  if (input.documents?.length) return false;
  const body = (input.bodyText ?? "").trim().toLowerCase();
  if (!body || body.length < 20) return true;
  return !REFERRAL_SIGNALS.some((signal) => body.includes(signal));
}

function normalizeGeminiModel(model?: string | null) {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_MODEL;
  return MODEL_ALIASES[trimmed] ?? trimmed;
}

export async function getGeminiModel() {
  const settings = await getGeneralSettings();
  return normalizeGeminiModel(process.env.GEMINI_MODEL ?? settings.openAiModel ?? DEFAULT_MODEL);
}

export function isGeminiQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("RESOURCE_EXHAUSTED") || message.includes("Quota exceeded");
}

async function resolveApiKey() {
  const apiKey = process.env.GEMINI_API_KEY ?? (await getOpenAiApiKey());
  if (!apiKey) {
    throw new Error("Save a Gemini API key in Settings or set GEMINI_API_KEY before syncing referral requests.");
  }
  return apiKey;
}

export async function getGeminiClient() {
  const apiKey = await resolveApiKey();
  return new GoogleGenAI({ apiKey });
}

export async function generateStructuredJson<T>(input: {
  systemInstruction: string;
  contents: GeminiContentPart[];
  responseJsonSchema: Record<string, unknown>;
  parser: { parse(value: unknown): T };
}) {
  const [client, model] = await Promise.all([getGeminiClient(), getGeminiModel()]);

  const request = async () => {
    const response = await client.models.generateContent({
      model,
      contents: input.contents,
      config: {
        systemInstruction: input.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: input.responseJsonSchema,
      },
    });
    if (!response.text) throw new Error("Gemini returned no structured extraction output.");
    return response.text;
  };

  const rawText = await request();
  return { value: input.parser.parse(JSON.parse(stripMarkdownJson(rawText))), model };
}

export function documentToPart(document: { filename: string; mimeType: string; content: Buffer }): Part | null {
  const supported =
    document.mimeType === "application/pdf" ||
    document.mimeType === "image/jpeg" ||
    document.mimeType === "image/png";
  if (!supported) return null;

  return {
    inlineData: {
      mimeType: document.mimeType,
      data: document.content.toString("base64"),
    },
  };
}
