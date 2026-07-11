import type { DetectionMethod, RequestStatus } from "@prisma/client";

import type { ApprovalDetection } from "@/server/extraction/schemas";
import { DetectionMethod as DetectionMethodEnum } from "@/server/db/enums";
import type { GmailMessageData } from "@/server/gmail/types";

import { detectRuleStatus, mostAdvancedStatus } from "./rules";

export type ApprovalEventCandidate = {
  gmailMessageId: string;
  status: RequestStatus;
  occurredAt: Date;
  confidence: number;
  evidence: string;
  detectionMethod: DetectionMethod;
};

export async function detectApprovalEvents(
  messages: GmailMessageData[],
  options?: { aiEvents?: ApprovalDetection["events"] },
) {
  const byMessage = new Map<string, ApprovalEventCandidate>();
  for (const message of messages) {
    const result = detectRuleStatus(message.subject, message.bodyText);
    if (result) byMessage.set(message.gmailMessageId, { gmailMessageId: message.gmailMessageId, occurredAt: message.receivedAt, ...result, detectionMethod: DetectionMethodEnum.RULES });
  }

  for (const event of options?.aiEvents ?? []) {
    if (!byMessage.has(event.gmailMessageId)) {
      const message = messages.find((item) => item.gmailMessageId === event.gmailMessageId);
      if (message) byMessage.set(event.gmailMessageId, { ...event, occurredAt: message.receivedAt, detectionMethod: DetectionMethodEnum.AI });
    }
  }

  const events = [...byMessage.values()].sort((first, second) => first.occurredAt.getTime() - second.occurredAt.getTime());
  return { events, status: mostAdvancedStatus(events.map((event) => event.status)) };
}
