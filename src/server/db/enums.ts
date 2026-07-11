import type {
  AttachmentExtractionStatus as AttachmentExtractionStatusValue,
  AttachmentStorageStatus as AttachmentStorageStatusValue,
  CentreStatus as CentreStatusValue,
  DetectionMethod as DetectionMethodValue,
  ExtractionOperation as ExtractionOperationValue,
  ExtractionRunStatus as ExtractionRunStatusValue,
  RequestStatus as RequestStatusValue,
  ReviewStatus as ReviewStatusValue,
  SyncRunStatus as SyncRunStatusValue,
} from "@prisma/client";

export const CentreStatus = {
  ACTIVE: "ACTIVE",
  PENDING_REVIEW: "PENDING_REVIEW",
  ARCHIVED: "ARCHIVED",
} as const satisfies Record<string, CentreStatusValue>;

export const RequestStatus = {
  RECEIVED: "RECEIVED",
  FORWARDED_TO_MANAGER: "FORWARDED_TO_MANAGER",
  MANAGER_APPROVED: "MANAGER_APPROVED",
  WAITING_MARKETING_APPROVAL: "WAITING_MARKETING_APPROVAL",
  MARKETING_RECOMMENDED: "MARKETING_RECOMMENDED",
  FINAL_APPROVED: "FINAL_APPROVED",
  SENT_TO_CENTRE: "SENT_TO_CENTRE",
  SENT_TO_FINANCE: "SENT_TO_FINANCE",
  PAID: "PAID",
} as const satisfies Record<string, RequestStatusValue>;

export const ReviewStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  REQUIRED: "REQUIRED",
  IN_REVIEW: "IN_REVIEW",
  RESOLVED: "RESOLVED",
} as const satisfies Record<string, ReviewStatusValue>;

export const AttachmentStorageStatus = {
  PENDING: "PENDING",
  ARCHIVED: "ARCHIVED",
  FAILED: "FAILED",
} as const satisfies Record<string, AttachmentStorageStatusValue>;

export const AttachmentExtractionStatus = {
  PENDING: "PENDING",
  EXTRACTED: "EXTRACTED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
} as const satisfies Record<string, AttachmentExtractionStatusValue>;

export const DetectionMethod = {
  RULES: "RULES",
  AI: "AI",
  MANUAL: "MANUAL",
  SYSTEM: "SYSTEM",
} as const satisfies Record<string, DetectionMethodValue>;

export const ExtractionOperation = {
  CANDIDATE_CLASSIFICATION: "CANDIDATE_CLASSIFICATION",
  REQUEST_EXTRACTION: "REQUEST_EXTRACTION",
  APPROVAL_DETECTION: "APPROVAL_DETECTION",
} as const satisfies Record<string, ExtractionOperationValue>;

export const ExtractionRunStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const satisfies Record<string, ExtractionRunStatusValue>;

export const SyncRunStatus = {
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const satisfies Record<string, SyncRunStatusValue>;
