import { RequestStatus } from "@prisma/client";

const statusOrder: RequestStatus[] = [
  RequestStatus.RECEIVED,
  RequestStatus.FORWARDED_TO_MANAGER,
  RequestStatus.MANAGER_APPROVED,
  RequestStatus.WAITING_MARKETING_APPROVAL,
  RequestStatus.MARKETING_RECOMMENDED,
  RequestStatus.FINAL_APPROVED,
  RequestStatus.SENT_TO_CENTRE,
  RequestStatus.SENT_TO_FINANCE,
  RequestStatus.PAID,
];

const patterns: Array<[RequestStatus, RegExp]> = [
  [RequestStatus.PAID, /\b(paid|payment (?:has been )?released|payment processed|settled)\b/i],
  [RequestStatus.SENT_TO_FINANCE, /\b(sent|forwarded|submitted).{0,60}\bfinance\b|\bfinance.{0,60}\b(sent|forwarded|submitted)\b/i],
  [RequestStatus.SENT_TO_CENTRE, /\b(sent|forwarded|communicated).{0,60}\bcentre\b|\bcentre.{0,60}\b(sent|forwarded|communicated)\b/i],
  [RequestStatus.FINAL_APPROVED, /\b(final approval|finally approved|approved for payment|approval granted)\b/i],
  [RequestStatus.MARKETING_RECOMMENDED, /\b(marketing (?:has )?recommended|recommended by marketing|marketing recommendation)\b/i],
  [RequestStatus.WAITING_MARKETING_APPROVAL, /\b(waiting|awaiting|pending).{0,60}\bmarketing\b/i],
  [RequestStatus.MANAGER_APPROVED, /\b(manager|management).{0,60}\bapproved\b|\bapproved by (?:the )?manager\b/i],
  [RequestStatus.FORWARDED_TO_MANAGER, /\b(forwarded|sent).{0,60}\bmanager\b|\bmanager approval\b/i],
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
  return statuses.reduce<RequestStatus>((current, status) => (statusRank(status) > statusRank(current) ? status : current), RequestStatus.RECEIVED);
}
