import type { gmail_v1 } from "googleapis";

import type { GmailAttachmentData, GmailMessageData, GmailThreadData } from "./types";

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;
}

function decodeBody(data?: string | null) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : undefined;
}

function parseAddress(value?: string) {
  if (!value) return { name: undefined, address: undefined };
  const match = value.match(/^(.*)<([^>]+)>$/);
  return match ? { name: match[1]?.trim().replace(/^"|"$/g, ""), address: match[2]?.trim() } : { name: undefined, address: value.trim() };
}

function splitRecipients(value?: string) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function collectParts(
  part: gmail_v1.Schema$MessagePart,
  messageId: string,
  attachments: GmailAttachmentData[],
  textBodies: string[],
  htmlBodies: string[],
) {
  const mimeType = part.mimeType ?? "application/octet-stream";
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      gmailMessageId: messageId,
      gmailAttachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType,
      sizeBytes: part.body.size ?? undefined,
      isInline: headerValue(part.headers, "Content-Disposition")?.toLowerCase().includes("inline") ?? false,
    });
  }
  if (mimeType === "text/plain") {
    const body = decodeBody(part.body?.data);
    if (body) textBodies.push(body);
  }
  if (mimeType === "text/html") {
    const body = decodeBody(part.body?.data);
    if (body) htmlBodies.push(body);
  }
  for (const nestedPart of part.parts ?? []) collectParts(nestedPart, messageId, attachments, textBodies, htmlBodies);
}

function parseMessage(message: gmail_v1.Schema$Message, threadId: string): GmailMessageData {
  const messageId = message.id;
  if (!messageId) throw new Error("Gmail message is missing an ID.");
  const headers = Object.fromEntries((message.payload?.headers ?? []).flatMap((header) => (header.name && header.value ? [[header.name, header.value]] : [])));
  const attachments: GmailAttachmentData[] = [];
  const textBodies: string[] = [];
  const htmlBodies: string[] = [];
  if (message.payload) collectParts(message.payload, messageId, attachments, textBodies, htmlBodies);
  const from = parseAddress(headers.From);
  const timestamp = Number(message.internalDate ?? Date.now());

  return {
    gmailMessageId: messageId,
    internetMessageId: headers["Message-ID"],
    fromName: from.name,
    fromAddress: from.address,
    toRecipients: splitRecipients(headers.To),
    ccRecipients: splitRecipients(headers.Cc),
    subject: headers.Subject,
    sentAt: new Date(headers.Date ?? timestamp),
    receivedAt: new Date(timestamp),
    bodyText: textBodies.join("\n\n") || undefined,
    bodyHtml: htmlBodies.join("\n\n") || undefined,
    headers,
    gmailUrl: `https://mail.google.com/mail/u/0/#all/${threadId}`,
    attachments,
  };
}

export function parseGmailThread(thread: gmail_v1.Schema$Thread): GmailThreadData {
  if (!thread.id) throw new Error("Gmail thread is missing an ID.");
  const messages = (thread.messages ?? []).map((message) => parseMessage(message, thread.id as string)).sort((first, second) => first.receivedAt.getTime() - second.receivedAt.getTime());
  return { gmailThreadId: thread.id, subject: messages[0]?.subject, historyId: thread.historyId ?? undefined, messages };
}
