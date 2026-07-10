import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  FORWARDED_TO_MANAGER: "bg-blue-100 text-blue-700",
  MANAGER_APPROVED: "bg-indigo-100 text-indigo-700",
  WAITING_MARKETING_APPROVAL: "bg-amber-100 text-amber-700",
  MARKETING_RECOMMENDED: "bg-violet-100 text-violet-700",
  FINAL_APPROVED: "bg-emerald-100 text-emerald-700",
  SENT_TO_CENTRE: "bg-cyan-100 text-cyan-700",
  SENT_TO_FINANCE: "bg-orange-100 text-orange-700",
  PAID: "bg-green-100 text-green-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", statusClasses[status] ?? "bg-slate-100 text-slate-700")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
