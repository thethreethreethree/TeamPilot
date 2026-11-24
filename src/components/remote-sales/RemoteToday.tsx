"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, Loader2, Target } from "lucide-react";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";
import { RepRoutine } from "./RepRoutine";
import { useRemoteMacroMode } from "@/lib/hooks/useRemoteMacroMode";
import { markTodaySeen } from "@/lib/coach/remote/todayShown";

/**
 * Remote Sales → Today (Macro Mode, docs/rss/MACRO-MODE-SPEC.md, 0303) — the brain dump at the start of the day.
 *
 *   "Hello <name>, what is our to-do list for the day?" → the rep writes their day in their own words.
 *   "What are our 2 biggest needle movers today?" → the organized plan marks two.
 *   An open-format read of yesterday — counted from the record (calls, average score, outcomes), never written by AI.
 *
 * The pipeline feeds it too: calls scheduled for today and to-dos due or overdue, so the plan starts from what the
 * rep already committed to. The plan is the rep's own; no manager reads it (0303). Below the plan, "Your coaching this
 * week" (RepRoutine, 2026-11-23): practice due, feedback answered, calls without a note.
 */
type Plan = { dump?: string; items: Array<{ time: string | null; what: string }>; needleMovers: string[]; createdAt?: string };
type DayRes = {
  available?: boolean;
  plan: Plan | null;
  yesterday: { calls: number; scored: number; averageScore: number | null; outcomes: Record<string, number> };
  today: { calls: Array<{ id: string; name: string | null }>; todos: Array<{ prospectId: string; name: string | null; title: string; due: string | null; overdue: boolean }>; pipelineFailed?: boolean };
};

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function RemoteToday() {
  const { enabled: macro } = useRemoteMacroMode();
  // Macro Mode is the PDF for everyone, managers included (founder picker 2026-11-25).
  const simple = macro === true;
  const [name, setName] = useState<string | null>(null);
  const [d, setD] = useState<DayRes | null>(null);
  const [failed, setFailed] = useState(false);
  const [dump, setDump] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const day = localDay();
  // Opening Today counts as having seen it today, so Calls won't send you back here (review 2026-11-25).
  useEffect(() => {
    if (macro === true) markTodaySeen();
  }, [macro]);
  const tz = new Date().getTimezoneOffset();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coach/remote/day?day=${day}&tz=${tz}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setD(await r.json());
      setFailed(false); // a later success clears an earlier failure (2026-11-23)
    } catch {
      setFailed(true);
    }
  }, [day, tz]);
  useEffect(() => {
    void load();
    fetch("/api/me/identity")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { fullName?: string | null } | null) => setName(j?.fullName?.split(/\s+/)[0] ?? null))
      .catch(() => {});
  }, [load]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, dump: dump.trim(), tzOffsetMin: tz }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; organized?: boolean };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save your plan.");
      if (!j.organized) setErr("Saved in your words — it couldn't be organized this time.");
      setEditing(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save your plan.");
    } finally {
      setBusy(false);
    }
  };

  const plan = d?.plan;
  // The blank form only once the day has LOADED and has no plan (2026-11-23). Before, it showed while loading and after
  // a failed load too — offering a rep who had already planned their day an empty form whose save replaces that plan.
  const showForm = editing || (d !== null && !plan);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-default bg-surface p-4">
        <h2 className="text-lg font-semibold text-primary">Hello{name ? ` ${name}` : ""}, what&apos;s our to-do list for the day?</h2>
        {showForm ? (
          <>
            <p className="mt-1 text-xs text-secondary">
              Write it the way you&apos;d say it. Then name your two biggest needle movers — the two things that, done today, move your sales forward.
            </p>
            <label htmlFor="dump" className="sr-only">Your day</label>
            <textarea
              id="dump"
              value={dump}
              onChange={(e) => setDump(e.currentTarget.value)}
              rows={5}
              maxLength={4000}
              placeholder={"Today I have a call with John at 9, then follow up with Michelle. Team meeting at 11, prospect demo at 3.\nNeedle movers: close Michelle, book John's second call."}
              className="mt-3 w-full rounded-lg border border-default bg-base p-3 text-sm text-primary"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void save()} disabled={busy || !dump.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Plan my day
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-default px-3 py-1.5 text-xs text-secondary">
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : !plan ? (
          failed ? (
            <p className="mt-2 text-xs text-muted">Couldn&apos;t load your plan for today. Refresh to try again.</p>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading your day…
            </p>
          )
        ) : (
          <div className="mt-3 space-y-4">
            {plan.needleMovers.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Your needle movers</p>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {plan.needleMovers.map((n, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-brand/50 bg-brand/10 p-3 text-sm font-medium text-primary">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.items.length > 0 ? (
              <ol className="space-y-1.5">
                {plan.items.map((it, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-muted">{it.time ?? "—"}</span>
                    <span className="text-primary">{it.what}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-primary">{plan.dump}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setDump(plan.dump ?? "");
                setEditing(true);
              }}
              className="text-xs text-secondary underline-offset-2 hover:text-primary hover:underline"
            >
              Change my plan
            </button>
          </div>
        )}
        {err && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
      </section>

      {/* "KEEP IT SIMPLE" (founder picker 2026-11-24): Today in Macro Mode is the brain dump and yesterday, nothing else. */}
      {!simple && <RepRoutine />}

      {failed ? (
        <p className="rounded-xl border border-default bg-surface p-4 text-xs text-muted">Couldn&apos;t load today&apos;s calls and to-dos. Refresh to try again.</p>
      ) : !d ? (
        <p className="flex items-center gap-2 p-4 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-default bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold text-primary">From your pipeline</h3>
            {d.today.pipelineFailed ? (
              <p className="text-xs text-muted">Couldn&apos;t read your pipeline right now.</p>
            ) : d.today.calls.length === 0 && d.today.todos.length === 0 ? (
              <p className="text-xs text-secondary">
                No calls scheduled and nothing due today. <Link href="/dashboard/remote-sales/pipeline" className="underline">Open your pipeline</Link>.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {d.today.calls.map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/remote-sales/pipeline?p=${c.id}`} className="flex items-center gap-2 text-primary hover:underline">
                      <CalendarClock className="h-4 w-4 text-brand" aria-hidden /> Call {c.name ?? "a prospect"} today
                    </Link>
                  </li>
                ))}
                {d.today.todos.map((t, i) => (
                  <li key={`${t.prospectId}-${i}`}>
                    <Link href={`/dashboard/remote-sales/pipeline?p=${t.prospectId}`} className={`flex items-center gap-2 hover:underline ${t.overdue ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}>
                      <AlertCircle className="h-4 w-4" aria-hidden />
                      {t.title}
                      <span className="text-[11px] text-muted">· {t.name ?? "prospect"}{t.overdue ? " · overdue" : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-default bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold text-primary">Yesterday</h3>
            {d.yesterday.calls === 0 ? (
              <p className="text-xs text-secondary">No phone or video calls yesterday.</p>
            ) : (
              <p className="text-sm text-primary">
                {d.yesterday.calls} {d.yesterday.calls === 1 ? "call" : "calls"}
                {d.yesterday.averageScore !== null ? `, averaging ${d.yesterday.averageScore} across ${d.yesterday.scored} scored` : ""}
                {Object.keys(d.yesterday.outcomes).length > 0
                  ? `. Outcomes: ${Object.entries(d.yesterday.outcomes)
                      .map(([k, n]) => `${n} ${outcomeLabel(k).toLowerCase()}`)
                      .join(", ")}.`
                  : "."}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
