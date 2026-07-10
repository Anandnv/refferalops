import { Download, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getRequestDetail } from "@/server/requests/query";

import { addNote } from "./actions";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getRequestDetail(id);
  if (!request) notFound();
  const addBoundNote = addNote.bind(null, request.id);

  return (
    <AppShell currentPath="/requests">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm text-khops-700 hover:underline" href="/requests">← All requests</Link><h1 className="mt-2">{request.patientName ?? "Referral request"}</h1><p className="mt-1 text-sm text-slate-500">{request.centre?.name ?? request.centreRaw ?? "Unknown centre"} · Received {formatDate(request.receivedAt)}</p></div><div className="flex gap-2"><StatusBadge status={request.status} /><Button asChild variant="outline"><a href={request.gmailUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" />Open Gmail</a></Button></div></div>
        <div className="grid gap-6 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2"><Card><CardHeader><h2>Patient information</h2></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">{[["Patient", request.patientName], ["Procedure", request.procedure], ["Details", request.procedureDetails], ["Discharge", formatDate(request.dischargeDate)], ["Payment type", request.paymentType], ["Referral hospital", request.referralHospital], ["Referral detail", request.referralDetail], ["Total amount", formatCurrency(request.totalReferralAmount?.toString())]].map(([label, value]) => <div key={String(label)}><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm text-slate-800">{value || "—"}</p></div>)}</CardContent></Card>
          <Card><CardHeader><h2>Beneficiaries</h2></CardHeader><div className="divide-y divide-slate-100">{request.beneficiaries.map((beneficiary) => <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" key={beneficiary.id}><div><p className="font-medium">{beneficiary.name ?? "Needs review"}</p><p className="text-sm text-slate-500">{beneficiary.type.replaceAll("_", " ")} {beneficiary.contact ? `· ${beneficiary.contact}` : ""}</p></div><p className="font-semibold">{formatCurrency(beneficiary.referralAmount?.toString())}</p></div>)}{request.beneficiaries.length === 0 ? <p className="p-5 text-sm text-slate-500">No beneficiaries were extracted.</p> : null}</div></Card>
          <Card><CardHeader><h2>Attachments</h2></CardHeader><div className="divide-y divide-slate-100">{request.attachments.map((attachment) => <div className="flex items-center justify-between gap-3 px-5 py-4" key={attachment.id}><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-slate-400" /><div><p className="text-sm font-medium">{attachment.filename}</p><p className="text-xs text-slate-500">{attachment.type.replaceAll("_", " ")} · {attachment.storageStatus}</p></div></div>{attachment.googleDriveFileId ? <a className="text-khops-700" href={`/api/attachments/${attachment.id}`}><Download className="h-4 w-4" /></a> : null}</div>)}{request.attachments.length === 0 ? <p className="p-5 text-sm text-slate-500">No attachments found.</p> : null}</div></Card></div>
          <div className="space-y-6"><Card><CardHeader><h2>Approval chain</h2></CardHeader><CardContent><ol className="space-y-5 border-l border-slate-200 pl-5">{request.timelineEvents.map((event) => <li className="relative" key={event.id}><span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-khops-500" /><p className="text-sm font-medium">{event.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(event.occurredAt)} · {event.detectionMethod}</p>{event.evidence ? <p className="mt-1 text-xs text-slate-600">{event.evidence}</p> : null}</li>)}{request.timelineEvents.length === 0 ? <li className="text-sm text-slate-500">No approval events detected yet.</li> : null}</ol></CardContent></Card>
            <Card><CardHeader><h2>Personal notes</h2></CardHeader><CardContent><form action={addBoundNote} className="space-y-3"><textarea className="min-h-24 w-full rounded-lg border p-3 text-sm outline-none focus:border-khops-500" name="content" placeholder="Add a private note" /><Button size="sm" type="submit">Save note</Button></form><div className="mt-5 space-y-3">{request.notes.map((note) => <div className="rounded-lg bg-slate-50 p-3" key={note.id}><p className="text-sm">{note.content}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(note.createdAt)}</p></div>)}</div></CardContent></Card>
            <Card><CardHeader><h2>Extraction review</h2></CardHeader><CardContent><p className="text-sm text-slate-600">Confidence: {request.extractionConfidence ? `${Math.round(Number(request.extractionConfidence) * 100)}%` : "—"}</p><p className="mt-2 text-sm text-slate-600">Review status: {request.reviewStatus.replaceAll("_", " ")}</p></CardContent></Card>
          </div></div>
      </div>
    </AppShell>
  );
}
