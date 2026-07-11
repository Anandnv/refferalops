import type { RequestStatus } from "@prisma/client";

import { RequestStatus as RequestStatusEnum } from "@/server/db/enums";

const statusOrder: RequestStatus[] = [
  RequestStatusEnum.RECEIVED,
  RequestStatusEnum.FORWARDED_TO_MANAGER,
  RequestStatusEnum.MANAGER_APPROVED,
  RequestStatusEnum.WAITING_MARKETING_APPROVAL,
  RequestStatusEnum.MARKETING_RECOMMENDED,
  RequestStatusEnum.FINAL_APPROVED,
  RequestStatusEnum.SENT_TO_CENTRE,
  RequestStatusEnum.SENT_TO_FINANCE,
  RequestStatusEnum.PAID,
];

const patterns: Array<[RequestStatus, RegExp]> = [
  [RequestStatusEnum.PAID, /\b(paid|payment (?:has been )?released|payment processed|settled)\b/i],
  [RequestStatusEnum.SENT_TO_FINANCE, /\b(sent|forwarded|submitted).{0,60}\bfinance\b|\bfinance.{0,60}\b(sent|forwarded|submitted)\b/i],
  [RequestStatusEnum.SENT_TO_CENTRE, /\b(sent|forwarded|communicated).{0,60}\bcentre\b|\bcentre.{0,60}\b(sent|forwarded|communicated)\b/i],
  [RequestStatusEnum.FINAL_APPROVED, /\b(final approval|finally approved|approved for payment|approval granted)\b/i],
  [RequestStatusEnum.MARKETING_RECOMMENDED, /\b(marketing (?:has )?recommended|recommended by marketing|marketing recommendation)\b/i],
  [RequestStatusEnum.WAITING_MARKETING_APPROVAL, /\b(waiting|awaiting|pending).{0,60}\bmarketing\b/i],
  [RequestStatusEnum.MANAGER_APPROVED, /\b(manager|management).{0,60}\bapproved\b|\bapproved by (?:the )?manager\b/i],
  [RequestStatusEnum.FORWARDED_TO_MANAGER, /\b(forwarded|sent).{0,60}\bmanager\b|\bmanager approval\b/i],
];

export function detectRuleStatus(subject?: string, body?: string) {
  const source = `${subject ?? ""}\n${body ?? ""}`;
  for (const [status, pattern] of patterns) {
    const matched = source.match(pattern);
    if (matched) return { status, evidence: matched[0], confidence: 0.92 };
  }
  return null;
}

export function statusRank(status: RequestStatus) {
  return statusOrder.indexOf(status);
}

export function mostAdvancedStatus(statuses: RequestStatus[]) {
  return statuses.reduce<RequestStatus>((current, status) => (statusRank(status) > statusRank(current) ? status : current), RequestStatusEnum.RECEIVED);
}
