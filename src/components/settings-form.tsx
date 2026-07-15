"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GeneralSettings } from "@/server/settings/service";

export function SettingsForm({ initial, hasGoogleClient, hasGoogleRefreshToken, hasOpenAiApiKey }: { initial: GeneralSettings; hasGoogleClient: boolean; hasGoogleRefreshToken: boolean; hasOpenAiApiKey: boolean }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Settings saved." : result.error ?? "Unable to save settings.");
    setSaving(false);
  }

  return <form className="space-y-8" onSubmit={submit}>
    <section><h2>General</h2><p className="mt-1 text-sm text-slate-500">Only this Gmail inbox will be monitored.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Operations Gmail<Input className="mt-1" defaultValue={initial.monitoredEmail} name="monitoredEmail" type="email" /></label><label className="text-sm font-medium">Sync interval (minutes)<Input className="mt-1" defaultValue={initial.syncIntervalMinutes} min="5" name="syncIntervalMinutes" type="number" /></label><label className="text-sm font-medium">Initial sync window (days)<Input className="mt-1" defaultValue={initial.initialSyncDays} min="1" name="initialSyncDays" type="number" /></label><label className="text-sm font-medium">Review confidence threshold<Input className="mt-1" defaultValue={initial.confidenceThreshold} max="1" min="0" name="confidenceThreshold" step="0.01" type="number" /></label></div></section>
    <section className="border-t pt-7"><h2>Google OAuth and Drive</h2><p className="mt-1 text-sm text-slate-500">Supporting attachments stay in Gmail for manual checking; they are not imported or processed. Secrets are encrypted in PostgreSQL with `APP_ENCRYPTION_KEY`.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Google OAuth client ID<Input className="mt-1" name="googleClientId" placeholder={hasGoogleClient ? "Configured — leave blank to keep" : "apps.googleusercontent.com"} /></label><label className="text-sm font-medium">Google OAuth client secret<Input className="mt-1" name="googleClientSecret" placeholder={hasGoogleClient ? "Configured — leave blank to keep" : "Client secret"} type="password" /></label><label className="text-sm font-medium">Export Drive folder ID<Input className="mt-1" defaultValue={initial.exportDriveFolderId} name="exportDriveFolderId" placeholder="Optional separate folder ID" /></label></div><div className="mt-4 flex flex-wrap items-center gap-3"><Button asChild disabled={!hasGoogleClient} variant="outline"><a href="/api/settings/google/connect">{hasGoogleRefreshToken ? "Reconnect Gmail" : "Connect Gmail"}</a></Button><span className="text-sm text-slate-500">{hasGoogleRefreshToken ? "Gmail connected" : "Gmail not connected"}</span></div></section>
    <section className="border-t pt-7"><h2>Excel export</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Workbook template Drive file ID<Input className="mt-1" defaultValue={initial.exportTemplateDriveFileId} name="exportTemplateDriveFileId" placeholder="Optional .xlsx template file ID" /></label><label className="text-sm font-medium">Export folder label<Input className="mt-1" defaultValue={initial.exportFolderName} name="exportFolderName" /></label></div></section>
    <section className="border-t pt-7"><h2>OpenAI extraction</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">GPT model<Input className="mt-1" defaultValue={initial.openAiModel} name="openAiModel" /></label><label className="text-sm font-medium">OpenAI API key<Input className="mt-1" name="openAiApiKey" placeholder={hasOpenAiApiKey ? "Configured — leave blank to keep" : "sk-..."} type="password" /></label></div></section>
    <div className="flex items-center gap-3 border-t pt-6"><Button disabled={saving} type="submit">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save settings</Button>{message ? <p className="text-sm text-slate-600">{message}</p> : null}</div>
  </form>;
}
