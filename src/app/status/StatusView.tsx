"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleSlash, Loader2, XCircle } from "lucide-react";
import { publicStatus, type PublicStatus } from "@/lib/status/publicStatus";

/** Reads /api/health on open and shows the four parts (publicStatus). A failed read says it couldn't check. */
export function StatusView() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok || r.status === 503 ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        if (!live) return;
        setStatus(publicStatus(j));
        setCheckedAt(new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
      });
    return () => {
      live = false;
    };
  }, []);
  if (!status)
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…
      </p>
    );
  return (
    <div className="mt-6">
      <p role="status" className={`rounded-xl border p-4 text-sm font-semibold ${status.overall === "ok" ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400" : status.overall === "degraded" ? "border-amber-500/50 text-amber-700 dark:text-amber-300" : "border-default text-secondary"}`}>
        {status.overall === "ok" ? "No problems detected" : status.overall === "degraded" ? "Some parts aren't working right now" : "We couldn't check the status just now. Refresh to try again."}
      </p>
      {status.parts.length > 0 && (
        <ul className="mt-4 divide-y divide-default rounded-xl border border-default">
          {status.parts.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-primary">{p.name}</span>
              <span className={`inline-flex items-center gap-1.5 ${p.state === "working" || p.state === "on" ? "text-emerald-700 dark:text-emerald-400" : p.state === "down" ? "text-amber-700 dark:text-amber-300" : "text-secondary"}`}>
                {p.state === "working" || p.state === "on" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : p.state === "down" ? <XCircle className="h-4 w-4" aria-hidden /> : <CircleSlash className="h-4 w-4" aria-hidden />}
                {p.note}
              </span>
            </li>
          ))}
        </ul>
      )}
      {checkedAt && (
        <p className="mt-3 text-xs text-muted">
          Checked at {checkedAt}. Sign-in and your data are tested live; the other parts show whether they are switched on.
          Refresh to check again.
        </p>
      )}
    </div>
  );
}
