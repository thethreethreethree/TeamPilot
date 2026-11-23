"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, HelpCircle, ListChecks } from "lucide-react";
import { repRoutineSteps, routineProgress, type RepCounts } from "@/lib/coach/remote/routine";

/**
 * "Your coaching this week" (2026-11-23, routine.ts repRoutineSteps; ledger F16.12, the self-coaching half) on Remote
 * Sales → Today: practice still due, answers to the feedback the rep asked for, and this week's calls with no note
 * from them — each a count with a link. Read from the rep's own records; a part that didn't load says so.
 */
type Mine = { answers: { answered: number; waiting: number; newestSessionId: string | null } | null; notes: { without: number; newestSessionId: string | null } | null };
const call = (id: string | null | undefined) => (id ? `/dashboard/remote-sales/calls/${id}` : null);

export function RepRoutine() {
  const [counts, setCounts] = useState<RepCounts | null>(null);

  useEffect(() => {
    let live = true;
    const practice = fetch("/api/coach/remote/assignments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { available?: boolean; assignments?: Array<{ state?: string }> }) =>
        j.available === false ? 0 : (j.assignments ?? []).filter((a) => a.state === "due" || a.state === "overdue").length,
      )
      .catch(() => null);
    const mine = fetch("/api/coach/remote/my-coaching", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Mine>) : Promise.reject(new Error(String(r.status)))))
      .catch(() => null);
    void Promise.all([practice, mine]).then(([p, m]) => {
      if (!live) return;
      setCounts({
        practice: p,
        answers: m?.answers?.answered ?? null,
        waiting: m?.answers?.waiting ?? null,
        notes: m?.notes?.without ?? null,
        answersHref: call(m?.answers?.newestSessionId),
        notesHref: call(m?.notes?.newestSessionId),
      });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!counts) return null;
  const steps = repRoutineSteps(counts);
  const p = routineProgress(steps);
  return (
    <section aria-label="Your coaching this week" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ListChecks className="h-4 w-4 text-brand" aria-hidden /> Your coaching this week
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
