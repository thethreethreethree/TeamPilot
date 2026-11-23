"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, HelpCircle, ListChecks } from "lucide-react";
import { routineProgress, routineSteps, type Count, type StepKey } from "@/lib/coach/remote/routine";

/**
 * "This week's coaching" (2026-11-23, routine.ts; ledger F16.12): the manager's routine, built from what is waiting
 * right now — feedback requests, score disputes, unscored calls, overdue practice — each with its count and a link to
 * where it's done. Renders nothing for a rep (every source is manager-only).
 */
async function read(url: string, pick: (j: unknown) => number): Promise<Count | "not-manager"> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 401 || r.status === 403) return "not-manager";
    if (!r.ok) return null;
    return pick(await r.json());
  } catch {
    return null;
  }
}

export function WeeklyRoutine() {
  const [counts, setCounts] = useState<Record<StepKey, Count> | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([
      read("/api/coach/remote/coaching-inbox", (j) => ((j as { items?: Array<{ open?: boolean }> }).items ?? []).filter((i) => i.open).length),
      read("/api/coach/sales-session/pitch-score/disputes?module=remote_sales", (j) => ((j as { disputes?: unknown[] }).disputes ?? []).length),
      read("/api/coach/sales-session/pitch-score/backfill?module=remote_sales", (j) => Number((j as { unscored?: number }).unscored ?? 0)),
      read("/api/coach/remote/assignments?team=1", (j) => ((j as { assignments?: Array<{ state?: string }> }).assignments ?? []).filter((a) => a.state === "overdue").length),
    ]).then(([feedback, disputes, unscored, practice]) => {
      if (!live) return;
      if ([feedback, disputes, unscored, practice].every((x) => x === "not-manager")) return setHidden(true);
      const n = (x: Count | "not-manager"): Count => (x === "not-manager" ? null : x);
      setCounts({ feedback: n(feedback), disputes: n(disputes), unscored: n(unscored), practice: n(practice) });
    });
    return () => {
      live = false;
    };
  }, []);

  if (hidden || !counts) return null;
  const steps = routineSteps(counts);
  const p = routineProgress(steps);
  return (
    <section aria-label="This week's coaching" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ListChecks className="h-4 w-4 text-brand" aria-hidden /> This week&apos;s coaching
        </h2>
        <span className="text-xs text-secondary">
          {p.done} of {p.checked} clear
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2 text-sm">
            {s.state === "done" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Clear" />
            ) : s.state === "todo" ? (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="To do" />
            ) : (
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-label="Couldn't check" />
            )}
            <span className="min-w-0">
              {s.state === "todo" ? (
                <a href={s.href} className="font-medium text-primary hover:underline">{s.label}</a>
              ) : (
                <span className={s.state === "done" ? "text-secondary" : "text-primary"}>{s.label}</span>
              )}
              <span className="block text-xs text-muted">{s.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
