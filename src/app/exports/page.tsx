import { Download, FileSpreadsheet } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ExportsPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return <AppShell currentPath="/exports"><div className="mx-auto max-w-3xl p-5 sm:p-8"><div className="mb-6"><h1>Monthly Excel export</h1><p className="mt-1 text-sm text-slate-500">Create a workbook with a separate sheet for every centre.</p></div><Card><CardContent className="p-6"><div className="flex items-start gap-4"><div className="rounded-xl bg-khops-50 p-3 text-khops-700"><FileSpreadsheet className="h-6 w-6" /></div><div><h2>Generate monthly workbook</h2><p className="mt-1 text-sm text-slate-500">The default workbook includes all extracted fields. Upload your existing workbook template to Drive and set its file ID in the export profile to reproduce its exact layout.</p><form action="/api/exports" className="mt-5 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Month<input className="ml-2 h-10 w-20 rounded-lg border px-3" defaultValue={month} max="12" min="1" name="month" type="number" /></label><label className="text-sm font-medium">Year<input className="ml-2 h-10 w-24 rounded-lg border px-3" defaultValue={year} min="2020" name="year" type="number" /></label><Button type="submit"><Download className="h-4 w-4" />Export Excel</Button></form></div></div></CardContent></Card></div></AppShell>;
}
