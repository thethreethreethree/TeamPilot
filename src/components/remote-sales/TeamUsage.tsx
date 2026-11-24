"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import type { CallTime, Counts, PersonUsage } from "@/lib/coach/remote/usage";

/**
 * Remote Sales → Coaching → Team usage (2026-11-23, usage.ts). For managers: who used the product in the last 7 and 30
 * days, and for what — sign-ins, calls, Ask Coach questions, practice, pipeline updates. Alphabetical, never ranked:
 * it shows adoption, not performance. Renders nothing for a rep (the route is manager-only).
 */
type Resp = { rows: PersonUsage[]; active7: number; active30: number; people: number; totals7: Counts; totals30: Counts; capped: string[] };
const COLS: Array<[keyof Counts, string]> = [
  ["signIns", "Sign-ins"],
  ["calls", "Calls"],
  ["questions", "Ask Coach"],
  ["practice", "Practice"],
  ["pipeline", "Pipeline"],
];
/** Hours and minutes on calls, e.g. "3h 05m" or "42m"; a dash when no call had a known length. */
const onCalls = (t: CallTime) => {
  if (!t.timed) return "—";
  const m = Math.round(t.seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};
/** Average call length, m:ss. */
const avgCall = (t: CallTime) => {
  if (!t.timed) return "—";
  const s = Math.round(t.seconds / t.timed);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export function TeamUsage() {
  const [data, setData] = useState<Resp | null>(null);
  const [state, setState] = useState<"loading" | "hidden" | "failed" | "ok">("loading");
  const [range, setRange] = useState<"last7" | "last30">("last7");

  useEffect(() => {
    let live = true;
    fetch("/api/coach/remote/usage", { cache: "no-store" })
      .then(async (r) => {
        if (!live) return;
        if (r.status === 403) return setState("hidden");
        if (!r.ok) return setState("failed");
        setData((await r.json()) as Resp);
        setState("ok");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, []);

  if (state === "hidden") return null;
  return (
    <section aria-label="Team usage" className="rounded-xl border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Activity className="h-4 w-4 text-brand" aria-hidden /> Team usage
        </h2>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default">
          {(["last7", "last30"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className={`px-2.5 py-1 text-xs ${range === k ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
              {k === "last7" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>
      {state === "loading" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
        </p>
      ) : state === "failed" || !data ? (
        <p className="mt-3 text-xs text-muted">Couldn&apos;t load team usage. Refresh to try again.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-secondary">
            <span className="font-semibold text-primary">{range === "last7" ? data.active7 : data.active30}</span> of {data.people} people used ELOSTATE in
            the last {range === "last7" ? "7" : "30"} days.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Person</th>
                  {COLS.map(([, label]) => (
                    <th key={label} className="py-1 pr-3 text-right font-medium">{label}</th>
                  ))}
                  <th className="py-1 pr-3 text-right font-medium">Time on calls</th>
                  <th className="py-1 pr-3 text-right font-medium">Avg call</th>
                  <th className="py-1 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id} className="border-t border-default">
                    <td className="py-1.5 pr-3 text-primary">{p.name}</td>
                    {COLS.map(([k]) => (
                      <td key={k} className={`py-1.5 pr-3 text-right tabular-nums ${p[range][k] ? "text-primary" : "text-muted"}`}>{p[range][k]}</td>
                    ))}
                    {(() => {
                      const t = range === "last7" ? p.time7 : p.time30;
                      const untimed = p[range].calls - t.timed;
                      return (
                        <>
                          <td className={`py-1.5 pr-3 text-right tabular-nums ${t.timed ? "text-primary" : "text-muted"}`} title={untimed > 0 ? `${untimed} ${untimed === 1 ? "call has" : "calls have"} no known length and ${untimed === 1 ? "isn't" : "aren't"} counted` : undefined}>
                            {onCalls(t)}
                            {untimed > 0 && t.timed > 0 ? "*" : ""}
                          </td>
                          <td className={`py-1.5 pr-3 text-right tabular-nums ${t.timed ? "text-primary" : "text-muted"}`}>{avgCall(t)}</td>
                        </>
                      );
                    })()}
                    <td className="py-1.5 text-secondary">{ago(p.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Counted from what the product already records: sign-ins through the email and password form, calls, Ask Coach
            questions on calls, practice attempts and pipeline changes. Time on calls adds up each call&apos;s recorded length (or,
            for a live call, start to end); * means some calls had no known length and aren&apos;t counted. Shown alphabetically —
            this is usage, not a ranking.
            {data.capped.length ? ` Some counts hit the 1,000-row read limit and may be higher: ${data.capped.join(", ")}.` : ""}
          </p>
        </>
      )}
    </section>
  );
}
