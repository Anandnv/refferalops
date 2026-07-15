"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function sync() {
    setState("loading");
    const response = await fetch("/api/sync", { method: "POST" });
    setState(response.ok ? "done" : "error");
    if (response.ok) window.location.reload();
  }

  return (
    <Button onClick={sync} disabled={state === "loading"} variant="outline">
      {state === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {state === "loading" ? "Loading this month…" : state === "error" ? "Sync failed" : "Load this month's Gmail"}
    </Button>
  );
}
