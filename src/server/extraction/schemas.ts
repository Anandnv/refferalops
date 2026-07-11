import { z } from "zod";

const nullableText = z.string().trim().nullable();

export const referralExtractionSchema = z.object({
  isReferralIncentive: z.boolean(),
  requestType: z.enum(["NORMAL", "SPECIAL"]).nullable(),
  centre: nullableText,
  patientName: nullableText,
  procedure: nullableText,
  procedureDetails: nullableText,
  dischargeDate: nullableText,
  paymentType: nullableText,
  referralHospital: nullableText,
  referralDetail: nullableText,
  beneficiaries: z.array(
    z.object({
      type: z.enum(["DOCTOR", "AMBULANCE_DRIVER", "KOL", "HOSPITAL_STAFF", "OTHER"]),
      customType: nullableText,
      name: nullableText,
      contact: nullableText,
      referralAmount: z.number().nonnegative().nullable(),
      confidence: z.number().min(0).max(1),
      evidence: nullableText,
    }),
  ),
  confidence: z.number().min(0).max(1),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)),
  uncertainFields: z.array(z.string()),
});

export const candidateClassificationSchema = z.object({
  isReferralIncentive: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500),
});

export const approvalDetectionSchema = z.object({
  events: z.array(
    z.object({
      gmailMessageId: z.string(),
      status: z.enum([
        "RECEIVED",
        "FORWARDED_TO_MANAGER",
        "MANAGER_APPROVED",
        "WAITING_MARKETING_APPROVAL",
        "MARKETING_RECOMMENDED",
        "FINAL_APPROVED",
        "SENT_TO_CENTRE",
        "SENT_TO_FINANCE",
        "PAID",
      ]),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(1000),
    }),
  ),
});

export const referralThreadAnalysisSchema = referralExtractionSchema.extend({
  rationale: z.string().max(500),
  approvalEvents: approvalDetectionSchema.shape.events,
});

export type ReferralExtraction = z.infer<typeof referralExtractionSchema>;
export type CandidateClassification = z.infer<typeof candidateClassificationSchema>;
export type ApprovalDetection = z.infer<typeof approvalDetectionSchema>;
export type ReferralThreadAnalysis = z.infer<typeof referralThreadAnalysisSchema>;
