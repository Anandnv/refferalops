import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings-form";
import { isDatabaseConfigured } from "@/server/requests/query";
import { getSettingsStatus } from "@/server/settings/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const configured = isDatabaseConfigured();
  const status = configured ? await getSettingsStatus() : null;
  return <AppShell currentPath="/settings"><div className="mx-auto max-w-4xl p-5 sm:p-8"><div className="mb-6"><h1>Settings</h1><p className="mt-1 text-sm text-slate-500">Configure the one permitted Google account, secure AI extraction, sync behavior, and Drive storage.</p></div><Card><CardContent className="p-6">{status ? <SettingsForm hasGoogleClient={status.hasGoogleClient} hasGoogleRefreshToken={status.hasGoogleRefreshToken} hasOpenAiApiKey={status.hasOpenAiApiKey} initial={status.general} /> : <p className="text-sm text-amber-700">Configure `DATABASE_URL` and apply the database migration before Settings can store encrypted integration credentials.</p>}</CardContent></Card></div></AppShell>;
}
