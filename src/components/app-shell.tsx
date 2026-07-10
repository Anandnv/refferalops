import { FileSpreadsheet, LayoutDashboard, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Referral Requests", icon: RefreshCw },
  { href: "/exports", label: "Monthly Export", icon: FileSpreadsheet },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="w-full border-b border-slate-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-khops-600 font-bold text-white">KH</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">KHOPS</p>
            <p className="text-xs text-slate-500">Referral Tracker</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                currentPath === href || currentPath.startsWith(`${href}/`)
                  ? "bg-khops-50 text-khops-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
              href={href}
              key={href}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
