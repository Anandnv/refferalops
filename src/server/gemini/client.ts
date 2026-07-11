import { GoogleGenAI, type Part } from "@google/genai";

import { getGeneralSettings, getOpenAiApiKey } from "@/server/settings/service";

const DEFAULT_MODEL = "gemini-2.5-flash";

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

const KH_REFERRAL_SUBJECT_SIGNALS = [
  "referral",
  "incentive",
  "khops",
  "beneficiary",
  "patient",
  "procedure",
  "discharge",
];

const NON_REFERRAL_SUBJECT_PATTERNS = [
  /\b(payment processed|payment released|has been paid|payment confirmation)\b/i,
  /\b(newsletter|notification only|system notification)\b/i,
];

export function subjectClearlyNotKhReferral(subject?: string) {
  const normalized = (subject ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (!/\bkh\b|khops/.test(normalized)) return true;
  if (KH_REFERRAL_SUBJECT_SIGNALS.some((signal) => normalized.includes(signal))) return false;
  return NON_REFERRAL_SUBJECT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function threadHasNoAnalyzableContent(thread: {
  messages: Array<{ bodyText?: string; attachments: Array<{ mimeType: string }> }>;
}) {
  const source = thread.messages[0];
  if (!source) return true;
  const hasRelevantAttachments = thread.messages.some((message) =>
    message.attachments.some(
      (attachment) => attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf",
    ),
  );
  return !hasRelevantAttachments && !(source.bodyText ?? "").trim();
}

export function shouldSkipGeminiAnalysis(input: {
  subject?: string;
  threadExistsInDatabase: boolean;
  thread: { messages: Array<{ bodyText?: string; attachments: Array<{ mimeType: string }> }> };
}) {
  if (input.threadExistsInDatabase) {
    return { skip: true, reason: "Skipped Gemini: Gmail thread already exists in database." };
  }
  if (subjectClearlyNotKhReferral(input.subject)) {
    return { skip: true, reason: "Skipped Gemini: subject does not relate to KH referral requests." };
  }
  if (threadHasNoAnalyzableContent(input.thread)) {
    return { skip: true, reason: "Skipped Gemini: no attachment and email body is empty." };
  }
  return { skip: false as const };
}

export function obviouslyNotReferralRequest(input: { bodyText?: string; documents?: unknown[] }) {
  if (input.documents?.length) return false;
  const body = (input.bodyText ?? "").trim().toLowerCase();
  if (!body || body.length < 20) return true;
  return !REFERRAL_SIGNALS.some((signal) => body.includes(signal));
}

export async function getGeminiModel() {
  const settings = await getGeneralSettings();
  return process.env.GEMINI_MODEL ?? settings.openAiModel ?? DEFAULT_MODEL;
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

  let rawText: string;
  try {
    rawText = await request();
    return { value: input.parser.parse(JSON.parse(stripMarkdownJson(rawText))), model };
  } catch (firstError) {
    try {
      rawText = await request();
      return { value: input.parser.parse(JSON.parse(stripMarkdownJson(rawText))), model };
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : "Gemini structured output failed.";
      throw new Error(message || (firstError instanceof Error ? firstError.message : "Gemini structured output failed."));
    }
  }
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
