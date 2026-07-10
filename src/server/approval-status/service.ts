import { DetectionMethod, RequestStatus } from "@prisma/client";

import { detectApprovalEventsWithAi } from "@/server/extraction/openai";
import type { GmailMessageData } from "@/server/gmail/types";
import { getOpenAiApiKey } from "@/server/settings/service";

import { detectRuleStatus, mostAdvancedStatus } from "./rules";

export type ApprovalEventCandidate = {
  gmailMessageId: string;
  status: RequestStatus;
  occurredAt: Date;
  confidence: number;
  evidence: string;
  detectionMethod: DetectionMethod;
};

export async function detectApprovalEvents(messages: GmailMessageData[]) {
  const byMessage = new Map<string, ApprovalEventCandidate>();
  for (const message of messages) {
    const result = detectRuleStatus(message.subject, message.bodyText);
    if (result) byMessage.set(message.gmailMessageId, { gmailMessageId: message.gmailMessageId, occurredAt: message.receivedAt, ...result, detectionMethod: DetectionMethod.RULES });
  }

  if (await getOpenAiApiKey()) {
    try {
      const detected = await detectApprovalEventsWithAi(messages.map((message) => ({ gmailMessageId: message.gmailMessageId, sentAt: message.sentAt, fromAddress: message.fromAddress, subject: message.subject, bodyText: message.bodyText })));
      for (const event of detected.value.events) {
        if (!byMessage.has(event.gmailMessageId)) {
          const message = messages.find((item) => item.gmailMessageId === event.gmailMessageId);
          if (message) byMessage.set(event.gmailMessageId, { ...event, occurredAt: message.receivedAt, detectionMethod: DetectionMethod.AI });
        }
      }
    } catch {}
  }

  const events = [...byMessage.values()].sort((first, second) => first.occurredAt.getTime() - second.occurredAt.getTime());
  return { events, status: mostAdvancedStatus(events.map((event) => event.status)) };
}
