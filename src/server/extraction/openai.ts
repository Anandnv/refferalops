import OpenAI from "openai";

import { getGeneralSettings, getOpenAiApiKey } from "@/server/settings/service";

import {
  approvalDetectionSchema,
  candidateClassificationSchema,
  referralExtractionSchema,
  type ApprovalDetection,
  type CandidateClassification,
  type ReferralExtraction,
} from "./schemas";

type DocumentInput = { filename: string; mimeType: string; content: Buffer };
type ThreadMessageInput = { gmailMessageId: string; sentAt: Date; fromAddress?: string; subject?: string; bodyText?: string };

const referralSchema = {
  type: "object",
  additionalProperties: false,
  required: ["isReferralIncentive", "requestType", "centre", "patientName", "procedure", "procedureDetails", "dischargeDate", "paymentType", "referralHospital", "referralDetail", "beneficiaries", "confidence", "fieldConfidence", "uncertainFields"],
  properties: {
    isReferralIncentive: { type: "boolean" },
    requestType: { type: ["string", "null"], enum: ["NORMAL", "SPECIAL", null] },
    centre: { type: ["string", "null"] }, patientName: { type: ["string", "null"] }, procedure: { type: ["string", "null"] }, procedureDetails: { type: ["string", "null"] }, dischargeDate: { type: ["string", "null"] }, paymentType: { type: ["string", "null"] }, referralHospital: { type: ["string", "null"] }, referralDetail: { type: ["string", "null"] },
    beneficiaries: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "customType", "name", "contact", "referralAmount", "confidence", "evidence"], properties: { type: { type: "string", enum: ["DOCTOR", "AMBULANCE_DRIVER", "KOL", "HOSPITAL_STAFF", "OTHER"] }, customType: { type: ["string", "null"] }, name: { type: ["string", "null"] }, contact: { type: ["string", "null"] }, referralAmount: { type: ["number", "null"] }, confidence: { type: "number" }, evidence: { type: ["string", "null"] } } } },
    confidence: { type: "number" }, fieldConfidence: { type: "object", additionalProperties: { type: "number" } }, uncertainFields: { type: "array", items: { type: "string" } },
  },
};

const candidateSchema = { type: "object", additionalProperties: false, required: ["isReferralIncentive", "confidence", "rationale"], properties: { isReferralIncentive: { type: "boolean" }, confidence: { type: "number" }, rationale: { type: "string" } } };

const approvalSchema = { type: "object", additionalProperties: false, required: ["events"], properties: { events: { type: "array", items: { type: "object", additionalProperties: false, required: ["gmailMessageId", "status", "confidence", "evidence"], properties: { gmailMessageId: { type: "string" }, status: { type: "string", enum: ["RECEIVED", "FORWARDED_TO_MANAGER", "MANAGER_APPROVED", "WAITING_MARKETING_APPROVAL", "MARKETING_RECOMMENDED", "FINAL_APPROVED", "SENT_TO_CENTRE", "SENT_TO_FINANCE", "PAID"] }, confidence: { type: "number" }, evidence: { type: "string" } } } } } };

async function clientAndModel() {
  const [apiKey, settings] = await Promise.all([getOpenAiApiKey(), getGeneralSettings()]);
  if (!apiKey) throw new Error("Save an OpenAI API key in Settings before syncing referral requests.");
  return { client: new OpenAI({ apiKey }), model: settings.openAiModel };
}

async function structuredResponse<T>(name: string, schema: Record<string, unknown>, instructions: string, content: unknown, parser: { parse(value: unknown): T }) {
  const { client, model } = await clientAndModel();
  const response = await client.responses.create({
    model,
    instructions,
    input: [{ role: "user", content: content as never }],
    text: { format: { type: "json_schema", name, strict: true, schema } },
  });
  if (!response.output_text) throw new Error("OpenAI returned no structured extraction output.");
  return { value: parser.parse(JSON.parse(response.output_text)), model };
}

export async function classifyReferralCandidate(input: { subject?: string; fromAddress?: string; bodyText?: string }) {
  return structuredResponse<CandidateClassification>(
    "referral_candidate",
    candidateSchema,
    "Classify whether this email is a KHOPS referral incentive request. Do not rely on exact subject matching. Return true only for a referral incentive request, not an unrelated approval or payment email.",
    [{ type: "input_text", text: JSON.stringify(input) }],
    candidateClassificationSchema,
  );
}

export async function extractReferralRequest(input: { subject?: string; fromAddress?: string; bodyText?: string; bodyHtml?: string; documents: DocumentInput[] }) {
  const documentContent = input.documents.slice(0, 12).map((document) => ({
    type: "input_file",
    filename: document.filename,
    file_data: `data:${document.mimeType};base64,${document.content.toString("base64")}`,
  }));
  return structuredResponse<ReferralExtraction>(
    "referral_incentive_extraction",
    referralSchema,
    "Extract referral-incentive facts from the email and attached referral documents. Use null for unknown values; never guess. Create one beneficiary item per payee. Classify multiple beneficiaries as SPECIAL. Use ISO date YYYY-MM-DD when a discharge date is present. Confidence values must be between zero and one and uncertainFields must name every weak or contradictory field.",
    [{ type: "input_text", text: JSON.stringify({ subject: input.subject, fromAddress: input.fromAddress, bodyText: input.bodyText, bodyHtml: input.bodyHtml }) }, ...documentContent],
    referralExtractionSchema,
  );
}

export async function detectApprovalEventsWithAi(messages: ThreadMessageInput[]) {
  return structuredResponse<ApprovalDetection>(
    "referral_approval_events",
    approvalSchema,
    "Read this chronological Gmail thread and return only explicit approval-chain events. Do not infer an approval from a request. Use the message ID provided for each event and a short evidence excerpt.",
    [{ type: "input_text", text: JSON.stringify(messages) }],
    approvalDetectionSchema,
  );
}
