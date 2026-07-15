import { google } from "googleapis";

import { getGeneralSettings, getGoogleCredentials, saveGoogleRefreshToken } from "@/server/settings/service";

import { parseGmailThread } from "./parser";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/drive.file"];

function redirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL must be configured before connecting Gmail.");
  return new URL("/api/settings/google/callback", appUrl).toString();
}

export async function getGoogleOAuthClient() {
  const credentials = await getGoogleCredentials();
  if (!credentials) throw new Error("Google OAuth client credentials have not been configured.");

  const client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret, redirectUri());
  if (credentials.refreshToken) client.setCredentials({ refresh_token: credentials.refreshToken });
  return client;
}

export async function getAuthenticatedGoogleClients() {
  const auth = await getGoogleOAuthClient();
  const [gmail, drive] = [google.gmail({ version: "v1", auth }), google.drive({ version: "v3", auth })];
  const profile = await gmail.users.getProfile({ userId: "me" });
  const settings = await getGeneralSettings();
  if (profile.data.emailAddress?.toLowerCase() !== settings.monitoredEmail.toLowerCase()) {
    throw new Error(`Connected Gmail account must be ${settings.monitoredEmail}.`);
  }
  return { gmail, drive, profile };
}

export async function createGoogleAuthorizationUrl() {
  const client = await getGoogleOAuthClient();
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: GMAIL_SCOPES });
}

export async function completeGoogleAuthorization(code: string) {
  const client = await getGoogleOAuthClient();
  const tokens = await client.getToken(code);
  if (!tokens.tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Reconnect with consent approval.");
  }
  await saveGoogleRefreshToken(tokens.tokens.refresh_token);
}


function gmailDate(value: Date) {
  return value.toISOString().slice(0, 10).replaceAll("-", "/");
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function findCandidateThreadIds(lastSuccessfulSyncAt?: Date | null, options?: { currentMonth?: boolean; labelId?: string }) {
  const { gmail } = await getAuthenticatedGoogleClients();
  const settings = await getGeneralSettings();
  const boundary = options?.currentMonth
    ? startOfCurrentMonth()
    : lastSuccessfulSyncAt
    ? new Date(lastSuccessfulSyncAt.getTime() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - settings.initialSyncDays * 24 * 60 * 60 * 1000);
  // A manual monthly reconciliation must examine every current-month thread.
  // Centre requests and approval replies often omit both "KH" and "referral"
  // from their subject/body, so Gmail keyword filtering loses valid requests.
  // Normal scheduled runs remain narrower to avoid reprocessing the full inbox.
  const query = options?.currentMonth
    ? `in:anywhere newer:${gmailDate(boundary)}`
    : `in:anywhere newer:${gmailDate(boundary)} {referral incentive khops}`;

  const threadIds = new Set<string>();
  let pageToken: string | undefined;
  do {
    const result = await gmail.users.messages.list({ userId: "me", q: query, labelIds: options?.labelId ? [options.labelId] : undefined, maxResults: 500, pageToken });
    for (const message of result.data.messages ?? []) {
      if (message.threadId) threadIds.add(message.threadId);
    }
    pageToken = result.data.nextPageToken ?? undefined;
  } while (pageToken);

  return [...threadIds];
}

export async function getGmailLabelId(labelName: string) {
  const { gmail } = await getAuthenticatedGoogleClients();
  const labels = await gmail.users.labels.list({ userId: "me" });
  return labels.data.labels?.find((label) => label.name?.trim().toUpperCase() === labelName.trim().toUpperCase())?.id;
}

export async function getGmailThread(gmailThreadId: string) {
  const { gmail } = await getAuthenticatedGoogleClients();
  const thread = await gmail.users.threads.get({ userId: "me", id: gmailThreadId, format: "full" });
  return parseGmailThread(thread.data);
}

export async function getGmailAttachment(gmailMessageId: string, gmailAttachmentId: string) {
  const { gmail } = await getAuthenticatedGoogleClients();
  const attachment = await gmail.users.messages.attachments.get({ userId: "me", messageId: gmailMessageId, id: gmailAttachmentId });
  if (!attachment.data.data) throw new Error(`Attachment ${gmailAttachmentId} did not contain data.`);
  return Buffer.from(attachment.data.data, "base64url");
}
