"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { Step } from "@/lib/coach/remote/gettingStarted";

/**
 * Remote Sales first-week checklist (F36.40; founder 2026-11-25 "Short checklist, dismissible"). Four steps that tick
 * themselves off from what the person did. Gone once all four are done, or when hidden ("Hide" is remembered in this
 * browser — a convenience, not a record). No pop-up tour. A failed load shows nothing: the checklist is optional help.
 */
const HIDE_KEY = "rss-getting-started-hidden";

export function GettingStarted() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let isHidden = false;
    try {
      isHidden = window.localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      /* storage unavailable: show it */
    }
    setHidden(isHidden);
    if (isHidden) return;
    let live = true;
    fetch("/api/coach/remote/getting-started", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { steps: Step[]; complete: boolean }) => live && !j.complete && setSteps(j.steps))
      .catch(() => {
        /* optional help: say nothing rather than a wrong checklist */
      });
    return () => {
      live = false;
    };
  }, []);

  if (hidden || !steps) return null;
  const done = steps.filter((s) => s.done).length;
  const hide = () => {
    try {
      window.localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* still hide for this visit */
    }
    setHidden(true);
  };
  return (
    <section aria-label="Getting started" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Getting started · {done} of {steps.length}</h2>
        <button type="button" onClick={hide} className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
          <X className="h-3.5 w-3.5" aria-hidden /> Hide
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Done" /> : <Circle className="h-4 w-4 text-muted" aria-label="Not yet" />}
            {s.done ? (
              <span className="text-secondary line-through">{s.label}</span>
            ) : (
              <Link href={s.href} className="text-primary hover:underline">{s.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
