export type GmailAttachmentData = {
  gmailMessageId: string;
  gmailAttachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  isInline: boolean;
};

export type GmailMessageData = {
  gmailMessageId: string;
  internetMessageId?: string;
  fromName?: string;
  fromAddress?: string;
  toRecipients: string[];
  ccRecipients: string[];
  subject?: string;
  sentAt: Date;
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  headers: Record<string, string>;
  gmailLabelIds: string[];
  gmailUrl: string;
  attachments: GmailAttachmentData[];
};

export type GmailThreadData = {
  gmailThreadId: string;
  subject?: string;
  historyId?: string;
  messages: GmailMessageData[];
};
