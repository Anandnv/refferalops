export const referralJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "isReferralIncentive",
    "requestType",
    "centre",
    "patientName",
    "procedure",
    "procedureDetails",
    "dischargeDate",
    "paymentType",
    "referralHospital",
    "referralDetail",
    "beneficiaries",
    "confidence",
    "fieldConfidence",
    "uncertainFields",
  ],
  properties: {
    isReferralIncentive: { type: "boolean" },
    requestType: { type: ["string", "null"], enum: ["NORMAL", "SPECIAL", null] },
    centre: { type: ["string", "null"] },
    patientName: { type: ["string", "null"] },
    procedure: { type: ["string", "null"] },
    procedureDetails: { type: ["string", "null"] },
    dischargeDate: { type: ["string", "null"] },
    paymentType: { type: ["string", "null"] },
    referralHospital: { type: ["string", "null"] },
    referralDetail: { type: ["string", "null"] },
    beneficiaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "customType", "name", "contact", "referralAmount", "confidence", "evidence"],
        properties: {
          type: { type: "string", enum: ["DOCTOR", "AMBULANCE_DRIVER", "KOL", "HOSPITAL_STAFF", "OTHER"] },
          customType: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          contact: { type: ["string", "null"] },
          referralAmount: { type: ["number", "null"] },
          confidence: { type: "number" },
          evidence: { type: ["string", "null"] },
        },
      },
    },
    confidence: { type: "number" },
    fieldConfidence: { type: "object", additionalProperties: { type: "number" } },
    uncertainFields: { type: "array", items: { type: "string" } },
  },
};

export const candidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["isReferralIncentive", "confidence", "rationale"],
  properties: {
    isReferralIncentive: { type: "boolean" },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
};

export const approvalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gmailMessageId", "status", "confidence", "evidence"],
        properties: {
          gmailMessageId: { type: "string" },
          status: {
            type: "string",
            enum: [
              "RECEIVED",
              "FORWARDED_TO_MANAGER",
              "MANAGER_APPROVED",
              "WAITING_MARKETING_APPROVAL",
              "MARKETING_RECOMMENDED",
              "FINAL_APPROVED",
              "SENT_TO_CENTRE",
              "SENT_TO_FINANCE",
              "PAID",
            ],
          },
          confidence: { type: "number" },
          evidence: { type: "string" },
        },
      },
    },
  },
};

export const threadAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "isReferralIncentive",
    "rationale",
    "requestType",
    "centre",
    "patientName",
    "procedure",
    "procedureDetails",
    "dischargeDate",
    "paymentType",
    "referralHospital",
    "referralDetail",
    "beneficiaries",
    "confidence",
    "fieldConfidence",
    "uncertainFields",
    "approvalEvents",
  ],
  properties: {
    ...referralJsonSchema.properties,
    rationale: { type: "string" },
    approvalEvents: approvalJsonSchema.properties.events,
  },
};
