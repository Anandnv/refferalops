import { createHash } from "node:crypto";

import { Prisma, SyncTrigger } from "@prisma/client";
import type { DetectionMethod, RequestStatus, SyncRunStatus as SyncRunStatusType } from "@prisma/client";

import type { ApprovalDetection } from "@/server/extraction/schemas";

import { detectApprovalEvents } from "@/server/approval-status/service";
import {
  CentreStatus,
  DetectionMethod as DetectionMethodEnum,
  ExtractionOperation,
  ExtractionRunStatus,
  RequestStatus as RequestStatusEnum,
  ReviewStatus,
  SyncRunStatus,
} from "@/server/db/enums";
import { analyzeReferralThread } from "@/server/gemini/analyzer";
import { isGeminiQuotaError } from "@/server/gemini/client";
import { shouldSkipGeminiAnalysis } from "@/server/gemini/client";
import { findCandidateThreadIds, getGmailLabelId, getGmailThread } from "@/server/gmail/client";
import type { GmailThreadData } from "@/server/gmail/types";
import { prisma } from "@/server/db/client";
import { getGeneralSettings, getOpenAiApiKey } from "@/server/settings/service";

type PersistedThread = { id: string; messageIds: Map<string, string> };
type SyncResult = { status: SyncRunStatusType; candidates: number; created: number; updated: number; duplicates: number; failures: string[] };

const IMMUTABLE_REQUEST_STATUSES = new Set<RequestStatus>([RequestStatusEnum.FINAL_APPROVED, RequestStatusEnum.PAID]);

function normalizeCentre(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function extractionHash(thread: GmailThreadData) {
  return createHash("sha256").update(JSON.stringify(thread.messages.map((message) => ({ id: message.gmailMessageId, body: message.bodyText })))).digest("hex");
}

async function persistThread(thread: GmailThreadData): Promise<PersistedThread> {
  return prisma.$transaction(async (tx) => {
    const threadRecord = await tx.gmailThread.upsert({
      where: { gmailThreadId: thread.gmailThreadId },
      create: { gmailThreadId: thread.gmailThreadId, subject: thread.subject, latestGmailMessageId: thread.messages.at(-1)?.gmailMessageId, latestHistoryId: thread.historyId, lastSyncedAt: new Date() },
      update: { subject: thread.subject, latestGmailMessageId: thread.messages.at(-1)?.gmailMessageId, latestHistoryId: thread.historyId, lastSyncedAt: new Date() },
    });
    const messageIds = new Map<string, string>();
    for (const message of thread.messages) {
      const data = {
        gmailThreadRecordId: threadRecord.id,
        internetMessageId: message.internetMessageId,
        fromName: message.fromName,
        fromAddress: message.fromAddress,
        toRecipients: message.toRecipients as Prisma.InputJsonValue,
        ccRecipients: message.ccRecipients as Prisma.InputJsonValue,
        subject: message.subject,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        headers: message.headers as Prisma.InputJsonValue,
        gmailUrl: message.gmailUrl,
      };
      const messageRecord = await tx.gmailMessage.upsert({
        where: { gmailMessageId: message.gmailMessageId },
        create: { gmailMessageId: message.gmailMessageId, ...data },
        update: data,
      });
      messageIds.set(message.gmailMessageId, messageRecord.id);
    }
    return { id: threadRecord.id, messageIds };
  });
}

async function resolveCentre(value: string | null) {
  if (!value) return { centreId: undefined, centreRaw: undefined };
  const normalized = normalizeCentre(value);
  const alias = await prisma.centreAlias.findUnique({ where: { normalizedAlias: normalized }, select: { centreId: true } });
  if (alias) return { centreId: alias.centreId, centreRaw: value };
  const centre = await prisma.centre.upsert({
    where: { normalizedName: normalized },
    create: { name: value.trim(), normalizedName: normalized, status: CentreStatus.PENDING_REVIEW },
    update: {},
  });
  return { centreId: centre.id, centreRaw: value };
}

async function persistTimeline(
  requestId: string,
  thread: GmailThreadData,
  messageIds: Map<string, string>,
  options?: { aiEvents?: ApprovalDetection["events"]; labelStatus?: RequestStatus },
) {
  const detection = await detectApprovalEvents(thread.messages, options);
  const sourceMessageId = messageIds.get(thread.messages[0]?.gmailMessageId ?? "");
  const receivedEvents = sourceMessageId ? [{ gmailMessageId: thread.messages[0].gmailMessageId, status: RequestStatusEnum.RECEIVED, occurredAt: thread.messages[0].receivedAt, confidence: 1, evidence: "Original referral request received.", detectionMethod: DetectionMethodEnum.SYSTEM }] : [];
  const labelSource = thread.messages.at(-1);
  const labelEvent = options?.labelStatus && labelSource
    ? [{
        gmailMessageId: labelSource.gmailMessageId,
        status: options.labelStatus,
        occurredAt: labelSource.receivedAt,
        confidence: 1,
        evidence: options.labelStatus === RequestStatusEnum.WAITING_MARKETING_APPROVAL ? "Gmail label: PENDING REF." : "Gmail label check: PENDING REF is not applied.",
        detectionMethod: DetectionMethodEnum.SYSTEM,
      }]
    : [];
  for (const event of [...receivedEvents, ...detection.events, ...labelEvent]) {
    const sourceGmailMessageRecordId = messageIds.get(event.gmailMessageId);
    if (!sourceGmailMessageRecordId) continue;
    await prisma.timelineEvent.upsert({
      where: { requestId_sourceGmailMessageRecordId_status: { requestId, sourceGmailMessageRecordId, status: event.status } },
      create: { requestId, sourceGmailMessageRecordId, status: event.status, occurredAt: event.occurredAt, confidence: event.confidence, evidence: event.evidence, detectionMethod: event.detectionMethod },
      update: { occurredAt: event.occurredAt, confidence: event.confidence, evidence: event.evidence, detectionMethod: event.detectionMethod },
    });
  }
  await prisma.referralRequest.update({ where: { id: requestId }, data: { status: options?.labelStatus ?? detection.status } });
}

async function createRequestFromThread(thread: GmailThreadData, persisted: PersistedThread, labelStatus?: RequestStatus) {
  const source = thread.messages[0];
  if (!source) return null;

  const skip = shouldSkipGeminiAnalysis({
    subject: source.subject ?? thread.subject,
    thread,
  });

  if (skip.skip) {
    const sourceMessageRecordId = persisted.messageIds.get(source.gmailMessageId);
    await prisma.extractionRun.create({
      data: {
        gmailMessageRecordId: sourceMessageRecordId,
        operation: ExtractionOperation.REQUEST_EXTRACTION,
        status: ExtractionRunStatus.SUCCEEDED,
        provider: "gemini",
        model: "skipped",
        inputHash: extractionHash(thread),
        confidence: 1,
        structuredOutput: {
          isReferralIncentive: false,
          rationale: skip.reason,
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
        } as Prisma.InputJsonValue,
        fieldConfidence: {} as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return null;
  }

  const analysis = await analyzeReferralThread({ thread });
  const sourceMessageRecordId = persisted.messageIds.get(source.gmailMessageId);
  await prisma.extractionRun.create({
    data: {
      gmailMessageRecordId: sourceMessageRecordId,
      operation: ExtractionOperation.REQUEST_EXTRACTION,
      status: ExtractionRunStatus.SUCCEEDED,
      provider: "gemini",
      model: analysis.model,
      inputHash: extractionHash(thread),
      confidence: analysis.value.confidence,
      structuredOutput: analysis.value as Prisma.InputJsonValue,
      fieldConfidence: analysis.value.fieldConfidence as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  if (!analysis.value.isReferralIncentive) return null;

  const settings = await getGeneralSettings();
  const centre = await resolveCentre(analysis.value.centre);
  if (!sourceMessageRecordId) throw new Error("Could not persist the source Gmail message.");
  const total = analysis.value.beneficiaries.reduce((sum, beneficiary) => sum + (beneficiary.referralAmount ?? 0), 0);
  const request = await prisma.referralRequest.create({
    data: {
      gmailThreadRecordId: persisted.id,
      sourceGmailMessageRecordId: sourceMessageRecordId,
      centreId: centre.centreId,
      centreRaw: centre.centreRaw,
      subject: source.subject ?? thread.subject ?? "Referral Incentive",
      patientName: analysis.value.patientName,
      procedure: analysis.value.procedure,
      procedureDetails: analysis.value.procedureDetails,
      dischargeDate: analysis.value.dischargeDate ? new Date(`${analysis.value.dischargeDate}T00:00:00.000Z`) : null,
      paymentType: analysis.value.paymentType,
      referralHospital: analysis.value.referralHospital,
      referralDetail: analysis.value.referralDetail,
      totalReferralAmount: total || null,
      requestType: analysis.value.requestType ?? (analysis.value.beneficiaries.length > 1 ? "SPECIAL" : "NORMAL"),
      reviewStatus: analysis.value.confidence >= settings.confidenceThreshold && analysis.value.uncertainFields.length === 0 ? ReviewStatus.NOT_REQUIRED : ReviewStatus.REQUIRED,
      extractionConfidence: analysis.value.confidence,
      extractionSummary: { uncertainFields: analysis.value.uncertainFields, fieldConfidence: analysis.value.fieldConfidence } as Prisma.InputJsonValue,
      receivedAt: source.receivedAt,
      gmailUrl: source.gmailUrl,
      beneficiaries: { create: analysis.value.beneficiaries.map((beneficiary) => ({ type: beneficiary.type, customType: beneficiary.customType, name: beneficiary.name, contact: beneficiary.contact, referralAmount: beneficiary.referralAmount, confidence: beneficiary.confidence, sourceEvidence: { evidence: beneficiary.evidence } })) },
    },
  });
  await persistTimeline(request.id, thread, persisted.messageIds, { aiEvents: analysis.value.approvalEvents, labelStatus });
  return request;
}

async function processThread(gmailThreadId: string, options?: { force?: boolean; pendingReferralLabelId?: string }) {
  if (!options?.force) {
    const immutableExisting = await prisma.referralRequest.findFirst({
      where: {
        status: { in: [RequestStatusEnum.FINAL_APPROVED, RequestStatusEnum.PAID] },
        gmailThread: { gmailThreadId },
      },
      select: { id: true, status: true },
    });
    if (immutableExisting && IMMUTABLE_REQUEST_STATUSES.has(immutableExisting.status)) {
      return "immutable" as const;
    }
  }

  const thread = await getGmailThread(gmailThreadId);
  const persisted = await persistThread(thread);
  const labelStatus = options?.pendingReferralLabelId
    ? thread.messages.some((message) => message.gmailLabelIds.includes(options.pendingReferralLabelId!))
      ? RequestStatusEnum.WAITING_MARKETING_APPROVAL
      : RequestStatusEnum.FINAL_APPROVED
    : undefined;
  const existing = await prisma.referralRequest.findUnique({ where: { gmailThreadRecordId: persisted.id } });
  if (existing) {
    await persistTimeline(existing.id, thread, persisted.messageIds, { labelStatus });
    return "updated" as const;
  }
  const created = await createRequestFromThread(thread, persisted, labelStatus);
  return created ? "created" as const : "ignored" as const;
}

export async function runReferralSync(input: { trigger: SyncTrigger; force?: boolean }) : Promise<SyncResult> {
  const settings = await getGeneralSettings();
  const latest = await prisma.syncLog.findFirst({ where: { status: { in: [SyncRunStatus.SUCCEEDED, SyncRunStatus.PARTIAL] } }, orderBy: { startedAt: "desc" } });
  const syncLog = await prisma.syncLog.create({ data: { trigger: input.trigger } });
  if (!input.force && latest && Date.now() - latest.startedAt.getTime() < settings.syncIntervalMinutes * 60_000) {
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncRunStatus.SKIPPED, completedAt: new Date() } });
    return { status: SyncRunStatus.SKIPPED, candidates: 0, created: 0, updated: 0, duplicates: 0, failures: [] };
  }
  if (!await getOpenAiApiKey()) {
    const message = "Set a Gemini API key in Settings before syncing.";
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncRunStatus.FAILED, completedAt: new Date(), error: { message } } });
    throw new Error(message);
  }

  // A manual sync reconciles the current month using the user's Gmail workflow:
  // every request has Referral Incentive, and the two still awaiting a decision
  // additionally have PENDING REF.
  const [referralIncentiveLabelId, pendingReferralLabelId] = await Promise.all([
    getGmailLabelId("Referral Incentive"),
    getGmailLabelId("PENDING REF"),
  ]);
  if (!referralIncentiveLabelId || !pendingReferralLabelId) {
    const missingLabel = referralIncentiveLabelId ? "PENDING REF" : "Referral Incentive";
    const message = `Gmail label '${missingLabel}' was not found. Create it or reconnect the Gmail account, then sync again.`;
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncRunStatus.FAILED, completedAt: new Date(), error: { message } } });
    throw new Error(message);
  }
  const candidateIds = await findCandidateThreadIds(latest?.startedAt, { currentMonth: input.force, labelId: referralIncentiveLabelId });
  const result: SyncResult = { status: SyncRunStatus.SUCCEEDED, candidates: candidateIds.length, created: 0, updated: 0, duplicates: 0, failures: [] };
  for (const threadId of candidateIds) {
    try {
      const outcome = await processThread(threadId, { force: input.force, pendingReferralLabelId });
      if (outcome === "created") result.created += 1;
      if (outcome === "updated") result.updated += 1;
      if (outcome === "ignored" || outcome === "immutable") result.duplicates += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      result.failures.push(message);
      if (isGeminiQuotaError(error)) break;
    }
  }
  if (result.failures.length) result.status = SyncRunStatus.PARTIAL;
  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: { status: result.status, completedAt: new Date(), candidateCount: result.candidates, threadCount: candidateIds.length, requestCreatedCount: result.created, requestUpdatedCount: result.updated, skippedDuplicateCount: result.duplicates, failedItemCount: result.failures.length, error: result.failures.length ? { messages: result.failures } : Prisma.JsonNull },
  });
  return result;
}
