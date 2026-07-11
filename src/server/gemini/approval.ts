import { approvalDetectionSchema, type ApprovalDetection } from "@/server/extraction/schemas";

import { generateStructuredJson } from "./client";
import { approvalJsonSchema } from "./schemas";

type ThreadMessageInput = {
  gmailMessageId: string;
  sentAt: Date;
  fromAddress?: string;
  subject?: string;
  bodyText?: string;
};

const APPROVAL_INSTRUCTIONS =
  "Read this chronological Gmail thread and return only explicit approval-chain events. Do not infer an approval from a request. Use the message ID provided for each event and a short evidence excerpt.";

export async function detectApprovalEventsWithAi(messages: ThreadMessageInput[]) {
  return generateStructuredJson<ApprovalDetection>({
    systemInstruction: APPROVAL_INSTRUCTIONS,
    contents: [JSON.stringify(messages)],
    responseJsonSchema: approvalJsonSchema,
    parser: approvalDetectionSchema,
  });
}
