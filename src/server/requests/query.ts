import { Prisma } from "@prisma/client";
import type { RequestStatus } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { RequestStatus as RequestStatusEnum } from "@/server/db/enums";

const approvedStatuses: RequestStatus[] = [
  RequestStatusEnum.FINAL_APPROVED,
  RequestStatusEnum.SENT_TO_CENTRE,
  RequestStatusEnum.SENT_TO_FINANCE,
  RequestStatusEnum.PAID,
];

export type RequestFilters = {
  search?: string;
  month?: number;
  year?: number;
  centreId?: string;
  procedure?: string;
  status?: RequestStatus;
  beneficiaryType?: string;
  paymentType?: string;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getDashboardSummary() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [totalRequests, pending, approved, special, monthlyRequests, monthlyAmount, latestSync] = await Promise.all([
    prisma.referralRequest.count(),
    prisma.referralRequest.count({ where: { status: { notIn: approvedStatuses } } }),
    prisma.referralRequest.count({ where: { status: { in: approvedStatuses } } }),
    prisma.referralRequest.count({ where: { requestType: "SPECIAL" } }),
    prisma.referralRequest.count({ where: { receivedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.referralRequest.aggregate({
      where: { receivedAt: { gte: monthStart, lt: nextMonth } },
      _sum: { totalReferralAmount: true },
    }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return {
    totalRequests,
    pending,
    approved,
    special,
    monthlyRequests,
    monthlyAmount: Number(monthlyAmount._sum.totalReferralAmount ?? 0),
    latestSync,
  };
}

export async function getFilterOptions() {
  const [centres, procedures, paymentTypes] = await Promise.all([
    prisma.centre.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.referralRequest.findMany({ where: { procedure: { not: null } }, distinct: ["procedure"], select: { procedure: true }, orderBy: { procedure: "asc" } }),
    prisma.referralRequest.findMany({ where: { paymentType: { not: null } }, distinct: ["paymentType"], select: { paymentType: true }, orderBy: { paymentType: "asc" } }),
  ]);
  return { centres, procedures: procedures.flatMap((item) => item.procedure ?? []), paymentTypes: paymentTypes.flatMap((item) => item.paymentType ?? []) };
}

export async function listRequests(filters: RequestFilters = {}) {
  const and: Prisma.ReferralRequestWhereInput[] = [];
  const search = filters.search?.trim();
  if (search) {
    const amount = Number(search.replaceAll(",", ""));
    and.push({
      OR: [
        { patientName: { contains: search, mode: "insensitive" } },
        { procedure: { contains: search, mode: "insensitive" } },
        { referralHospital: { contains: search, mode: "insensitive" } },
        { centre: { name: { contains: search, mode: "insensitive" } } },
        { beneficiaries: { some: { name: { contains: search, mode: "insensitive" } } } },
        { beneficiaries: { some: { contact: { contains: search, mode: "insensitive" } } } },
        ...(Number.isFinite(amount) ? [{ totalReferralAmount: { equals: amount } }, { beneficiaries: { some: { referralAmount: { equals: amount } } } }] : []),
      ],
    });
  }
  if (filters.centreId) and.push({ centreId: filters.centreId });
  if (filters.procedure) and.push({ procedure: filters.procedure });
  if (filters.status) and.push({ status: filters.status });
  if (filters.paymentType) and.push({ paymentType: filters.paymentType });
  if (filters.beneficiaryType) and.push({ beneficiaries: { some: { type: filters.beneficiaryType as never } } });
  if (filters.month && filters.year) {
    const start = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const end = new Date(Date.UTC(filters.year, filters.month, 1));
    and.push({ receivedAt: { gte: start, lt: end } });
  }

  return prisma.referralRequest.findMany({
    where: and.length ? { AND: and } : undefined,
    include: { centre: true, beneficiaries: { where: { type: "DOCTOR" }, take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
}

export async function getRequestDetail(id: string) {
  return prisma.referralRequest.findUnique({
    where: { id },
    include: {
      centre: true,
      beneficiaries: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      timelineEvents: { include: { sourceMessage: true }, orderBy: { occurredAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      gmailThread: { include: { messages: { orderBy: { receivedAt: "asc" } } } },
      extractionRuns: { orderBy: { startedAt: "desc" }, take: 5 },
    },
  });
}
