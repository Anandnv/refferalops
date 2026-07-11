import { candidateClassificationSchema, type CandidateClassification } from "@/server/extraction/schemas";

import { generateStructuredJson, obviouslyNotReferralRequest } from "./client";
import { candidateJsonSchema } from "./schemas";

const CLASSIFICATION_INSTRUCTIONS =
  "Classify whether this email is a KHOPS referral incentive request. Do not rely on exact subject matching. Return true only for a referral incentive request, not an unrelated approval or payment email.";

export async function classifyReferralCandidate(input: { subject?: string; fromAddress?: string; bodyText?: string }) {
  if (obviouslyNotReferralRequest({ bodyText: input.bodyText })) {
    return {
      value: candidateClassificationSchema.parse({
        isReferralIncentive: false,
        confidence: 1,
        rationale: "Skipped Gemini: no attachments and email body contains no referral request signals.",
      } satisfies CandidateClassification),
      model: "skipped",
    };
  }

  return generateStructuredJson<CandidateClassification>({
    systemInstruction: CLASSIFICATION_INSTRUCTIONS,
    contents: [JSON.stringify(input)],
    responseJsonSchema: candidateJsonSchema,
    parser: candidateClassificationSchema,
  });
}
