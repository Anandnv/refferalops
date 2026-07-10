import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { getFilterOptions, isDatabaseConfigured, listRequests, type RequestFilters } from "@/server/requests/query";

export const dynamic = "force-dynamic";

const statuses = ["RECEIVED", "FORWARDED_TO_MANAGER", "MANAGER_APPROVED", "WAITING_MARKETING_APPROVAL", "MARKETING_RECOMMENDED", "FINAL_APPROVED", "SENT_TO_CENTRE", "SENT_TO_FINANCE", "PAID"] as const;

function numberParam(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const configured = isDatabaseConfigured();
  const filters: RequestFilters = { search: params.search, month: numberParam(params.month), year: numberParam(params.year), centreId: params.centreId, procedure: params.procedure, status: params.status as RequestFilters["status"], beneficiaryType: params.beneficiaryType, paymentType: params.paymentType };
  const [requests, options] = configured ? await Promise.all([listRequests(filters), getFilterOptions()]) : [[], { centres: [], procedures: [], paymentTypes: [] }];

  return (
    <AppShell currentPath="/requests">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6"><h1>Referral requests</h1><p className="mt-1 text-sm text-slate-500">Search by patient, doctor, centre, hospital, procedure, contact, amount, or status.</p></div>
        <Card className="mb-6"><CardContent>
          <form className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" defaultValue={filters.search} name="search" placeholder="Search referrals" /></div>
            <select className="h-10 rounded-lg border bg-white px-3 text-sm" defaultValue={filters.centreId} name="centreId"><option value="">All centres</option>{options.centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}</select>
            <select className="h-10 rounded-lg border bg-white px-3 text-sm" defaultValue={filters.status} name="status"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
            <select className="h-10 rounded-lg border bg-white px-3 text-sm" defaultValue={filters.beneficiaryType} name="beneficiaryType"><option value="">All beneficiaries</option><option value="DOCTOR">Doctor</option><option value="AMBULANCE_DRIVER">Ambulance Driver</option><option value="KOL">KOL</option><option value="HOSPITAL_STAFF">Hospital Staff</option><option value="OTHER">Other</option></select>
            <Input defaultValue={filters.month} max="12" min="1" name="month" placeholder="Month" type="number" /><div className="flex gap-2"><Input defaultValue={filters.year} min="2020" name="year" placeholder="Year" type="number" /><Button type="submit">Filter</Button></div>
          </form>
        </CardContent></Card>
        <Card><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Patient", "Centre", "Procedure", "Doctor", "Amount", "Status", "Received", "Gmail"].map((heading) => <th className="px-5 py-3 font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{requests.map((request) => <tr className="hover:bg-slate-50" key={request.id}><td className="px-5 py-4 font-medium"><Link className="text-khops-700 hover:underline" href={`/requests/${request.id}`}>{request.patientName ?? "Needs review"}</Link></td><td className="px-5 py-4">{request.centre?.name ?? request.centreRaw ?? "—"}</td><td className="px-5 py-4">{request.procedure ?? "—"}</td><td className="px-5 py-4">{request.beneficiaries[0]?.name ?? "—"}</td><td className="px-5 py-4">{formatCurrency(request.totalReferralAmount?.toString())}</td><td className="px-5 py-4"><StatusBadge status={request.status} /></td><td className="px-5 py-4 text-slate-500">{formatDate(request.receivedAt)}</td><td className="px-5 py-4"><a aria-label="Open Gmail thread" className="text-khops-700" href={request.gmailUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /></a></td></tr>)}{configured && requests.length === 0 ? <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={8}>No referral requests match these filters.</td></tr> : null}</tbody></table></div></Card>
      </div>
    </AppShell>
  );
}
