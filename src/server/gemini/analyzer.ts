import { referralThreadAnalysisSchema, type ReferralThreadAnalysis } from "@/server/extraction/schemas";
import type { GmailThreadData } from "@/server/gmail/types";

import { generateStructuredJson, shouldSkipGeminiAnalysis } from "./client";
import { threadAnalysisJsonSchema } from "./schemas";

const THREAD_ANALYSIS_INSTRUCTIONS = `Analyze this KHOPS referral incentive Gmail thread and return one structured JSON response.

TASK 1 — CLASSIFICATION
Decide whether the source (first) message is a KHOPS referral incentive request. Do not rely on exact subject matching. Return true only for a referral incentive request, not an unrelated approval or payment email. Provide a short rationale.

TASK 2 — EXTRACTION
Extract referral-incentive facts from the email content only. Do not use or request attached supporting documents. Use null for unknown values; never guess. Create one beneficiary item per payee. Classify multiple beneficiaries as SPECIAL. Use ISO date YYYY-MM-DD when a discharge date is present. Confidence values must be between zero and one and uncertainFields must name every weak or contradictory field.

TASK 3 — APPROVAL EVENTS
Read the full chronological thread and return only explicit approval-chain events. Do not infer an approval from the request itself. Use the gmailMessageId provided for each event and a short evidence excerpt.

If isReferralIncentive is false, leave extraction fields null or empty and approvalEvents empty.`;

function skippedAnalysis(reason: string): ReferralThreadAnalysis {
  return referralThreadAnalysisSchema.parse({
    isReferralIncentive: false,
    rationale: reason,
    requestType: null,
    centre: null,
    patientName: null,
    procedure: null,
    procedureDetails: null,
    dischargeDate: null,
    paymentType: null,
    referralHospital: null,
    referralDetail: null,
    beneficiaries: [],
    confidence: 1,
    fieldConfidence: {},
    uncertainFields: [],
    approvalEvents: [],
  });
}

export async function analyzeReferralThread(input: {
  thread: GmailThreadData;
}) {
  const source = input.thread.messages[0];
  const skip = shouldSkipGeminiAnalysis({
    subject: source?.subject ?? input.thread.subject,
    thread: input.thread,
  });
  if (skip.skip) {
    return { value: skippedAnalysis(skip.reason), model: "skipped" };
  }

  return generateStructuredJson<ReferralThreadAnalysis>({
    systemInstruction: THREAD_ANALYSIS_INSTRUCTIONS,
    contents: [
      JSON.stringify({
        sourceMessage: {
          subject: source?.subject,
          fromAddress: source?.fromAddress,
          bodyText: source?.bodyText,
          bodyHtml: source?.bodyHtml,
        },
        threadMessages: input.thread.messages.map((message) => ({
          gmailMessageId: message.gmailMessageId,
          sentAt: message.sentAt,
          fromAddress: message.fromAddress,
          subject: message.subject,
          bodyText: message.bodyText,
        })),
      }),
    ],
    responseJsonSchema: threadAnalysisJsonSchema,
    parser: referralThreadAnalysisSchema,
  });
}
