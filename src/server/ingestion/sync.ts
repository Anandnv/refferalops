import { createHash } from "node:crypto";

import { AttachmentExtractionStatus, AttachmentStorageStatus, CentreStatus, DetectionMethod, ExtractionOperation, ExtractionRunStatus, Prisma, RequestStatus, ReviewStatus, SyncRunStatus, SyncTrigger } from "@prisma/client";

import { detectApprovalEvents } from "@/server/approval-status/service";
import { inferAttachmentType, canPreview } from "@/server/documents/classifier";
import { archiveInDrive } from "@/server/documents/drive";
import { classifyReferralCandidate, extractReferralRequest } from "@/server/extraction/openai";
import { findCandidateThreadIds, getGmailAttachment, getGmailThread } from "@/server/gmail/client";
import type { GmailAttachmentData, GmailThreadData } from "@/server/gmail/types";
import { prisma } from "@/server/db/client";
import { getGeneralSettings, getOpenAiApiKey } from "@/server/settings/service";

type PersistedThread = { id: string; messageIds: Map<string, string> };
type SyncResult = { status: SyncRunStatus; candidates: number; created: number; updated: number; duplicates: number; failures: string[] };

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function normalizeCentre(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function extractionHash(thread: GmailThreadData) {
  return createHash("sha256").update(JSON.stringify(thread.messages.map((message) => ({ id: message.gmailMessageId, body: message.bodyText, attachments: message.attachments.map((attachment) => attachment.gmailAttachmentId) })))).digest("hex");
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

async function attachmentBuffers(thread: GmailThreadData) {
  const buffers = new Map<string, Buffer>();
  for (const attachment of thread.messages.flatMap((message) => message.attachments)) {
    if ((attachment.sizeBytes ?? 0) > MAX_DOCUMENT_BYTES) continue;
    if (!attachment.mimeType.startsWith("image/") && attachment.mimeType !== "application/pdf") continue;
    buffers.set(`${attachment.gmailMessageId}:${attachment.gmailAttachmentId}`, await getGmailAttachment(attachment.gmailMessageId, attachment.gmailAttachmentId));
  }
  return buffers;
}

async function persistAttachments(requestId: string, thread: GmailThreadData, messages: Map<string, string>, buffers: Map<string, Buffer>) {
  for (const attachment of thread.messages.flatMap((message) => message.attachments)) {
    const gmailMessageRecordId = messages.get(attachment.gmailMessageId);
    if (!gmailMessageRecordId) continue;
    const existing = await prisma.attachment.findUnique({ where: { gmailMessageRecordId_gmailAttachmentId: { gmailMessageRecordId, gmailAttachmentId: attachment.gmailAttachmentId } } });
    const row = existing ?? await prisma.attachment.create({
      data: {
        requestId,
        gmailMessageRecordId,
        gmailAttachmentId: attachment.gmailAttachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        isInline: attachment.isInline,
        type: inferAttachmentType(attachment.filename, attachment.mimeType),
        previewAvailable: canPreview(attachment.mimeType),
      },
    });
    if (row.googleDriveFileId || row.storageStatus === AttachmentStorageStatus.FAILED) continue;
    try {
      const key = `${attachment.gmailMessageId}:${attachment.gmailAttachmentId}`;
      const buffer = buffers.get(key) ?? await getGmailAttachment(attachment.gmailMessageId, attachment.gmailAttachmentId);
      const driveId = await archiveInDrive({ filename: attachment.filename, mimeType: attachment.mimeType, buffer });
      await prisma.attachment.update({
        where: { id: row.id },
        data: { googleDriveFileId: driveId, sha256: createHash("sha256").update(buffer).digest("hex"), storageStatus: AttachmentStorageStatus.ARCHIVED, extractionStatus: AttachmentExtractionStatus.EXTRACTED },
      });
    } catch {
      await prisma.attachment.update({ where: { id: row.id }, data: { storageStatus: AttachmentStorageStatus.FAILED, extractionStatus: AttachmentExtractionStatus.FAILED } });
    }
  }
}

async function persistTimeline(requestId: string, thread: GmailThreadData, messageIds: Map<string, string>) {
  const detection = await detectApprovalEvents(thread.messages);
  const sourceMessageId = messageIds.get(thread.messages[0]?.gmailMessageId ?? "");
  const receivedEvents = sourceMessageId ? [{ gmailMessageId: thread.messages[0].gmailMessageId, status: RequestStatus.RECEIVED, occurredAt: thread.messages[0].receivedAt, confidence: 1, evidence: "Original referral request received.", detectionMethod: DetectionMethod.SYSTEM }] : [];
  for (const event of [...receivedEvents, ...detection.events]) {
    const sourceGmailMessageRecordId = messageIds.get(event.gmailMessageId);
    if (!sourceGmailMessageRecordId) continue;
    await prisma.timelineEvent.upsert({
      where: { requestId_sourceGmailMessageRecordId_status: { requestId, sourceGmailMessageRecordId, status: event.status } },
      create: { requestId, sourceGmailMessageRecordId, status: event.status, occurredAt: event.occurredAt, confidence: event.confidence, evidence: event.evidence, detectionMethod: event.detectionMethod },
      update: { occurredAt: event.occurredAt, confidence: event.confidence, evidence: event.evidence, detectionMethod: event.detectionMethod },
    });
  }
  await prisma.referralRequest.update({ where: { id: requestId }, data: { status: detection.status } });
}

async function createRequestFromThread(thread: GmailThreadData, persisted: PersistedThread) {
  const source = thread.messages[0];
  if (!source) return null;
  const classification = await classifyReferralCandidate({ subject: source.subject, fromAddress: source.fromAddress, bodyText: source.bodyText });
  await prisma.extractionRun.create({
    data: {
      gmailMessageRecordId: persisted.messageIds.get(source.gmailMessageId),
      operation: ExtractionOperation.CANDIDATE_CLASSIFICATION,
      status: ExtractionRunStatus.SUCCEEDED,
      provider: "openai",
      model: classification.model,
      inputHash: extractionHash(thread),
      confidence: classification.value.confidence,
      structuredOutput: classification.value as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  if (!classification.value.isReferralIncentive) return null;

  const buffers = await attachmentBuffers(thread);
  const extraction = await extractReferralRequest({
    subject: source.subject,
    fromAddress: source.fromAddress,
    bodyText: source.bodyText,
    bodyHtml: source.bodyHtml,
    documents: thread.messages.flatMap((message) => message.attachments).flatMap((attachment) => {
      const content = buffers.get(`${attachment.gmailMessageId}:${attachment.gmailAttachmentId}`);
      return content ? [{ filename: attachment.filename, mimeType: attachment.mimeType, content }] : [];
    }),
  });
  if (!extraction.value.isReferralIncentive) return null;
  const settings = await getGeneralSettings();
  const centre = await resolveCentre(extraction.value.centre);
  const sourceMessageRecordId = persisted.messageIds.get(source.gmailMessageId);
  if (!sourceMessageRecordId) throw new Error("Could not persist the source Gmail message.");
  const total = extraction.value.beneficiaries.reduce((sum, beneficiary) => sum + (beneficiary.referralAmount ?? 0), 0);
  const request = await prisma.referralRequest.create({
    data: {
      gmailThreadRecordId: persisted.id,
      sourceGmailMessageRecordId: sourceMessageRecordId,
      centreId: centre.centreId,
      centreRaw: centre.centreRaw,
      subject: source.subject ?? thread.subject ?? "Referral Incentive",
      patientName: extraction.value.patientName,
      procedure: extraction.value.procedure,
      procedureDetails: extraction.value.procedureDetails,
      dischargeDate: extraction.value.dischargeDate ? new Date(`${extraction.value.dischargeDate}T00:00:00.000Z`) : null,
      paymentType: extraction.value.paymentType,
      referralHospital: extraction.value.referralHospital,
      referralDetail: extraction.value.referralDetail,
      totalReferralAmount: total || null,
      requestType: extraction.value.requestType ?? (extraction.value.beneficiaries.length > 1 ? "SPECIAL" : "NORMAL"),
      reviewStatus: extraction.value.confidence >= settings.confidenceThreshold && extraction.value.uncertainFields.length === 0 ? ReviewStatus.NOT_REQUIRED : ReviewStatus.REQUIRED,
      extractionConfidence: extraction.value.confidence,
      extractionSummary: { uncertainFields: extraction.value.uncertainFields, fieldConfidence: extraction.value.fieldConfidence } as Prisma.InputJsonValue,
      receivedAt: source.receivedAt,
      gmailUrl: source.gmailUrl,
      beneficiaries: { create: extraction.value.beneficiaries.map((beneficiary) => ({ type: beneficiary.type, customType: beneficiary.customType, name: beneficiary.name, contact: beneficiary.contact, referralAmount: beneficiary.referralAmount, confidence: beneficiary.confidence, sourceEvidence: { evidence: beneficiary.evidence } })) },
    },
  });
  await prisma.extractionRun.create({
    data: {
      requestId: request.id,
      gmailMessageRecordId: sourceMessageRecordId,
      operation: ExtractionOperation.REQUEST_EXTRACTION,
      status: ExtractionRunStatus.SUCCEEDED,
      provider: "openai",
      model: extraction.model,
      inputHash: extractionHash(thread),
      confidence: extraction.value.confidence,
      structuredOutput: extraction.value as Prisma.InputJsonValue,
      fieldConfidence: extraction.value.fieldConfidence as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  await persistAttachments(request.id, thread, persisted.messageIds, buffers);
  await persistTimeline(request.id, thread, persisted.messageIds);
  return request;
}

async function processThread(gmailThreadId: string) {
  const thread = await getGmailThread(gmailThreadId);
  const persisted = await persistThread(thread);
  const existing = await prisma.referralRequest.findUnique({ where: { gmailThreadRecordId: persisted.id } });
  if (existing) {
    const buffers = await attachmentBuffers(thread);
    await persistAttachments(existing.id, thread, persisted.messageIds, buffers);
    await persistTimeline(existing.id, thread, persisted.messageIds);
    return "updated" as const;
  }
  const created = await createRequestFromThread(thread, persisted);
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
  if (!settings.driveFolderId || !await getOpenAiApiKey()) {
    const message = !settings.driveFolderId ? "Set a Google Drive folder ID in Settings before syncing." : "Set an OpenAI API key in Settings before syncing.";
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: SyncRunStatus.FAILED, completedAt: new Date(), error: { message } } });
    throw new Error(message);
  }

  const candidateIds = await findCandidateThreadIds(latest?.startedAt);
  const result: SyncResult = { status: SyncRunStatus.SUCCEEDED, candidates: candidateIds.length, created: 0, updated: 0, duplicates: 0, failures: [] };
  for (const threadId of candidateIds) {
    try {
      const outcome = await processThread(threadId);
      if (outcome === "created") result.created += 1;
      if (outcome === "updated") result.updated += 1;
      if (outcome === "ignored") result.duplicates += 1;
    } catch (error) {
      result.failures.push(error instanceof Error ? error.message : "Unknown sync error");
    }
  }
  if (result.failures.length) result.status = SyncRunStatus.PARTIAL;
  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: { status: result.status, completedAt: new Date(), candidateCount: result.candidates, threadCount: candidateIds.length, requestCreatedCount: result.created, requestUpdatedCount: result.updated, skippedDuplicateCount: result.duplicates, failedItemCount: result.failures.length, error: result.failures.length ? { messages: result.failures } : Prisma.JsonNull },
  });
  return result;
}
