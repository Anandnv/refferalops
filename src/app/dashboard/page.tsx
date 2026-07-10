import { AlertTriangle, CheckCircle2, ClipboardList, IndianRupee, Sparkles, Timer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDashboardSummary, isDatabaseConfigured } from "@/server/requests/query";

export const dynamic = "force-dynamic";

const cardDefinitions = [
  { key: "pending", label: "Pending", icon: Timer, color: "text-amber-600 bg-amber-50" },
  { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  { key: "special", label: "Special Requests", icon: Sparkles, color: "text-violet-600 bg-violet-50" },
  { key: "monthlyRequests", label: "Monthly Total", icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
  { key: "monthlyAmount", label: "This Month Amount", icon: IndianRupee, color: "text-khops-600 bg-khops-50" },
  { key: "totalRequests", label: "Total Requests", icon: ClipboardList, color: "text-slate-600 bg-slate-100" },
] as const;

export default async function DashboardPage() {
  const configured = isDatabaseConfigured();
  const summary = configured ? await getDashboardSummary() : null;

  return (
    <AppShell currentPath="/dashboard">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><h1>Referral dashboard</h1><p className="mt-1 text-sm text-slate-500">Track every referral incentive request from Gmail to payment.</p></div>
          <SyncButton />
        </div>
        {!configured ? (
          <Card className="border-amber-200 bg-amber-50"><CardContent className="flex gap-3 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" />Add `DATABASE_URL` to `.env`, apply the Prisma migration, then configure Google and OpenAI in Settings.</CardContent></Card>
        ) : summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cardDefinitions.map(({ key, label, icon: Icon, color }) => (
                <Card key={key}><CardContent className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{key === "monthlyAmount" ? formatCurrency(summary[key]) : summary[key]}</p></div><div className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" /></div></CardContent></Card>
              ))}
            </div>
            <Card className="mt-6"><CardContent><p className="text-sm font-medium text-slate-700">Sync health</p><p className="mt-1 text-sm text-slate-500">Last run: {formatDateTime(summary.latestSync?.completedAt ?? summary.latestSync?.startedAt)}</p><p className="mt-2 text-sm text-slate-500">The scheduler checks every five minutes and respects your Settings interval.</p></CardContent></Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
