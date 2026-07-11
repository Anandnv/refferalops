import { referralExtractionSchema, type ReferralExtraction } from "@/server/extraction/schemas";

import { documentToPart, generateStructuredJson, obviouslyNotReferralRequest } from "./client";
import { referralJsonSchema } from "./schemas";

type DocumentInput = { filename: string; mimeType: string; content: Buffer };

const EXTRACTION_INSTRUCTIONS =
  "Extract referral-incentive facts from the email and attached referral documents. Use null for unknown values; never guess. Create one beneficiary item per payee. Classify multiple beneficiaries as SPECIAL. Use ISO date YYYY-MM-DD when a discharge date is present. Confidence values must be between zero and one and uncertainFields must name every weak or contradictory field.";

export async function extractReferralRequest(input: {
  subject?: string;
  fromAddress?: string;
  bodyText?: string;
  bodyHtml?: string;
  documents: DocumentInput[];
}) {
  const documents = input.documents.slice(0, 12);

  if (obviouslyNotReferralRequest({ bodyText: input.bodyText, documents })) {
    return {
      value: referralExtractionSchema.parse({
        isReferralIncentive: false,
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
      } satisfies ReferralExtraction),
      model: "skipped",
    };
  }

  const documentParts = documents.flatMap((document) => {
    const part = documentToPart(document);
    return part ? [part] : [];
  });

  return generateStructuredJson<ReferralExtraction>({
    systemInstruction: EXTRACTION_INSTRUCTIONS,
    contents: [
      JSON.stringify({
        subject: input.subject,
        fromAddress: input.fromAddress,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
      }),
      ...documentParts,
    ],
    responseJsonSchema: referralJsonSchema,
    parser: referralExtractionSchema,
  });
}
