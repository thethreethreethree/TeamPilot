"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { accuracyBand, accuracyOverQuarter, latest, metrics, movement, periodOf, rollUp, shiftPeriod, type FDeal, type Submission, WEEKDAYS } from "@/lib/coach/remote/revenue/forecast";

/**
 * Pipeline → Forecast → the board (revenue Phase 6, 0376; Gong M22). One row per person in view — you, or your team —
 * for a quarter: Closed won and Open closing (computed from the pipeline in view), Commit and Best case (submitted),
 * and Target. You submit your own numbers (no note: free text could quote a customer, 0381); a manager sets targets for the reps under them. The team row
 * adds everyone's latest numbers and says how many have submitted. Last quarter's accuracy (Commit ÷ closed won) shows
 * in Gong's colours.
 */
const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
// Gong's green / pink / red, in the brand's warm palette (docs/BRAND.md: no red or green), each with a word so the
// colour is never the only signal.
const BAND = { green: "bg-brand/20 text-primary", pink: "bg-amber-500/15 text-amber-700 dark:text-amber-300", red: "border border-amber-500/40 text-amber-700 dark:text-amber-300" } as const;
const BAND_WORD = { green: "on target", pink: "close", red: "off" } as const;

type Data = { period: string; viewerId: string; submissions: Submission[]; targets: Array<{ userId: string; period: string; amount: number; team?: boolean }>; dueWeekday?: number | null; canSetDue?: boolean };

export function ForecastBoard({ deals, people, isManager, nameOf, today, teamView = true }: { deals: FDeal[]; people: string[]; isManager: boolean; nameOf: (id: string) => string | null; today: string; teamView?: boolean }) {
  const [period, setPeriod] = useState(periodOf(today));
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  // "team_target" (0386, revenue phase 7): the viewer's own team's quarterly revenue target.
  const [editing, setEditing] = useState<{ userId: string; col: "commit" | "best_case" | "target" | "team_target" } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/forecast?period=${period}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Partial<Data>;
      // A reply in any other shape is a failed read, said as one — never a board built on nothing.
      if (!Array.isArray(j.submissions) || !Array.isArray(j.targets) || typeof j.viewerId !== "string") throw new Error("shape");
      setData(j as Data);
    } catch {
      setFailed(true);
    }
  }, [period]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const ids = new Set(people);
    if (data) ids.add(data.viewerId);
    return [...ids];
  }, [people, data]);

  const save = async () => {
    if (!editing || !data) return;
    const v = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amount.trim() || !Number.isFinite(v)) return setMsg("Enter an amount.");
    setBusy(true);
    setMsg(null);
    try {
      const body = editing.col === "target" || editing.col === "team_target"
        ? { kind: "target", period, userId: editing.userId, amount: v, ...(editing.col === "team_target" ? { team: true } : {}) }
        : { kind: "submit", period, category: editing.col, amount: v };
      const r = await fetch("/api/coach/remote/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that.");
      setEditing(null);
      setAmount("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  const setDueDay = async (weekday: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "due_day", weekday }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the due day.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save the due day.");
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="text-xs text-secondary">Couldn&apos;t load the forecast. Refresh to try again.</p>;
  if (!data) return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading the forecast…</p>;

  const prev = shiftPeriod(period, -1);
  const target = (u: string) => data.targets.find((t) => t.userId === u && t.period === period && !t.team)?.amount ?? null;
  // The team's own target (set by its manager), else the sum of its people's targets, said as a sum.
  const teamTarget = data.targets.find((t) => t.team && t.userId === data.viewerId && t.period === period)?.amount ?? null;
  const cell = (u: string, col: "commit" | "best_case" | "target") => {
    const own = u === data.viewerId;
    const canEdit = col === "target" ? isManager : own;
    const sub = col === "target" ? null : latest(data.submissions, u, period, col);
    const value = col === "target" ? target(u) : sub?.amount ?? null;
    const label = value === null ? (canEdit ? (col === "target" ? "Set" : "Submit") : "—") : money(value);
    // A submitted number anyone may open (the deals behind it, how it moved); only its owner (or, for a target, a
    // manager) can change it.
    return canEdit || sub ? (
      <button type="button" onClick={() => { setEditing({ userId: u, col }); setAmount(value === null ? "" : String(value)); setMsg(null); }} title={sub ? `Submitted ${new Date(sub.createdAt).toLocaleString()}` : undefined} className={`rounded px-1.5 py-0.5 tabular-nums underline-offset-2 hover:underline ${value === null ? "text-secondary" : "font-semibold text-primary"}`}>
        {label}
      </button>
    ) : (
      <span className={`tabular-nums ${value === null ? "text-muted" : "text-primary"}`}>{label}</span>
    );
  };
  const team = rows.length > 1;
  const commitTeam = rollUp(data.submissions, rows, period, "commit");
  const bestTeam = rollUp(data.submissions, rows, period, "best_case");
  const mAll = metrics(deals, period);
  const targetTeam = rows.reduce((s, u) => s + (target(u) ?? 0), 0);
  // 0394/0395: a split can credit part of a deal to someone not shown here; said, so the rows never seem to miss money.
  const shownWon = rows.reduce((s, u) => s + metrics(deals, period, u).closedWon, 0);
  const outsideWon = Math.max(0, Math.round(mAll.closedWon - shownWon));

  return (
    <section aria-label="Forecast board" className="space-y-2 rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-primary">Forecast board</p>
          {/* 0391 (F22.4): when forecasts are due; anyone who forecasts and hasn't submitted that week gets a bell reminder from the night run before it. */}
          {data.dueWeekday === null ? (
            <span className="text-[11px] text-muted">Couldn&apos;t read the due day</span>
          ) : data.canSetDue ? (
            <label className="flex items-center gap-1 text-[11px] text-secondary">
              Due every
              <select value={data.dueWeekday ?? 1} disabled={busy} aria-label="Forecast due day" onChange={(e) => void setDueDay(Number(e.currentTarget.value))} className="rounded border border-default bg-base px-1 py-0.5 text-[11px] text-primary">
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </label>
          ) : (
            <span className="text-[11px] text-secondary">Due every {WEEKDAYS[data.dueWeekday ?? 1]}</span>
          )}
        </div>
        <div role="group" aria-label="Quarter" className="inline-flex overflow-hidden rounded-lg border border-default text-[11px]">
          {[-1, 0, 1].map((k) => {
            const p = shiftPeriod(periodOf(today), k);
            return (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`px-2 py-1 ${period === p ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
                {p.replace("-", " ")}
              </button>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-2 py-1.5 font-medium">Person</th>
              <th className="px-2 py-1.5 text-right font-medium" title="Won deals that closed in this quarter">Closed won</th>
              <th className="px-2 py-1.5 text-right font-medium" title="Open deals expected to close in this quarter">Open closing</th>
              <th className="px-2 py-1.5 text-right font-medium">Commit</th>
              <th className="px-2 py-1.5 text-right font-medium">Best case</th>
              <th className="px-2 py-1.5 text-right font-medium">Target</th>
              <th className="px-2 py-1.5 text-right font-medium" title={`${prev}: last Commit ÷ closed won`}>Last quarter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const m = metrics(deals, period, u);
              const t = target(u);
              const lastCommit = latest(data.submissions, u, prev, "commit");
              const prevWon = metrics(deals, prev, u).closedWon;
              const acc = lastCommit ? accuracyBand(lastCommit.amount, prevWon) : null;
              // Week by week (each submission is a snapshot): how the Commit standing compared with what closed.
              const weekly = accuracyOverQuarter(data.submissions, u, prev, prevWon)
                .map((w) => `${w.asOf}: ${money(w.forecast)}${w.accuracy ? ` (${Math.round(w.accuracy.ratio * 100)}%)` : ""}`)
                .join("\n");
              return (
                <tr key={u} className="border-t border-default">
                  <td className="px-2 py-1.5 text-primary">{u === data.viewerId ? "You" : nameOf(u) ?? "A rep"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-primary">
                    {money(m.closedWon)}
                    {t ? <span className="block text-[10px] text-muted">{Math.round((m.closedWon / t) * 100)}% of target</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-secondary">{money(m.openClosing)}{m.openUnpriced ? <span className="block text-[10px] text-muted">{m.openUnpriced} unpriced</span> : null}</td>
                  <td className="px-2 py-1.5 text-right">{cell(u, "commit")}</td>
                  <td className="px-2 py-1.5 text-right">{cell(u, "best_case")}</td>
                  <td className="px-2 py-1.5 text-right">{cell(u, "target")}</td>
                  <td className="px-2 py-1.5 text-right">
                    {acc ? <span title={weekly || undefined} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${BAND[acc.band]}`}>{Math.round(acc.ratio * 100)}% · {BAND_WORD[acc.band]}</span> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
            {team && (
              <tr className="border-t-2 border-default font-semibold">
                <td className="px-2 py-1.5 text-primary">Team</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary">{money(mAll.closedWon)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-secondary">{money(mAll.openClosing)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary">{money(commitTeam.amount)}<span className="block text-[10px] font-normal text-muted">{commitTeam.submitted} of {commitTeam.of} submitted</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary">{money(bestTeam.amount)}<span className="block text-[10px] font-normal text-muted">{bestTeam.submitted} of {bestTeam.of} submitted</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary">
                  {/* The team's own target belongs to the whole-team view only (review 2026-11-27): with one rep picked, this
                      row is that rep's deals, so it shows the sum of targets in view, not the team's. */}
                  {isManager && teamView ? (
                    <button type="button" onClick={() => { setEditing({ userId: data.viewerId, col: "team_target" }); setAmount(teamTarget === null ? "" : String(teamTarget)); setMsg(null); }} className="rounded px-1.5 py-0.5 tabular-nums underline-offset-2 hover:underline">
                      {teamTarget !== null ? money(teamTarget) : targetTeam ? money(targetTeam) : "Set team target"}
                    </button>
                  ) : (
                    <span>{teamView && teamTarget !== null ? money(teamTarget) : targetTeam ? money(targetTeam) : "—"}</span>
                  )}
                  {teamView && teamTarget !== null ? (
                    teamTarget > 0 ? <span className="block text-[10px] font-normal text-muted">{Math.round((mAll.closedWon / teamTarget) * 100)}% of team target</span> : null
                  ) : targetTeam ? (
                    <span className="block text-[10px] font-normal text-muted">sum of people&apos;s targets</span>
                  ) : null}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
        {outsideWon > 0 && <p className="mt-1 text-[10px] text-muted">{money(outsideWon)} of Closed won here is credited by deal splits to people not on this board.</p>}
      </div>
      {editing && (
        <div className="space-y-1.5 rounded-lg border border-default p-2 text-xs">
          <p className="font-semibold text-primary">
            {editing.col === "team_target" ? "Your team's revenue target" : editing.col === "target" ? `Target for ${editing.userId === data.viewerId ? "you" : nameOf(editing.userId) ?? "this rep"}` : `${editing.userId === data.viewerId ? "Your" : `${nameOf(editing.userId) ?? "This rep"}'s`} ${editing.col === "commit" ? "Commit" : "Best case"}`} · {period.replace("-", " ")}
          </p>
          {editing.col !== "target" && editing.col !== "team_target" && (
            <SubmissionDetail
              own={editing.userId === data.viewerId}
              sub={latest(data.submissions, editing.userId, period, editing.col)}
              moved={movement(data.submissions, editing.userId, period, editing.col)}
              m={metrics(deals, period, editing.userId)}
              target={target(editing.userId)}
              dealName={(id) => deals.find((d) => d.id === id)?.name ?? null}
            />
          )}
          {(editing.col === "target" || editing.col === "team_target" ? isManager : editing.userId === data.viewerId) ? (
            <div className="flex flex-wrap gap-2">
              <input autoFocus value={amount} onChange={(e) => setAmount(e.currentTarget.value)} inputMode="decimal" aria-label="Amount" placeholder="Amount" className="w-32 rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
              <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className="px-2 text-muted hover:text-primary">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(null)} className="text-muted hover:text-primary">Close</button>
          )}
          {msg && <p className="text-amber-700 dark:text-amber-300">{msg}</p>}
        </div>
      )}
      <p className="text-[11px] text-muted">
        Closed won counts deals by when they were marked won; open closing by their expected close date. Each submission is
        kept, so last quarter&apos;s accuracy compares the Commit standing at its end with what actually closed (on target: 85–115%).
      </p>
    </section>
  );
}

/**
 * One submitted number, opened (Gong F22.3, F22.6): when it was submitted, the open deals behind it at that moment, how it
 * moved since the one before (amount, deals in and out), and progress to target. A deal the reader can't see is counted,
 * not named.
 */
function SubmissionDetail({ own, sub, moved, m, target, dealName }: {
  own: boolean;
  sub: Submission | null;
  moved: ReturnType<typeof movement>;
  m: ReturnType<typeof metrics>;
  target: number | null;
  dealName: (id: string) => string | null;
}) {
  const names = (ids: string[]) => {
    const named = ids.map(dealName).filter((n): n is string => !!n);
    const rest = ids.length - named.length;
    return [...named, ...(rest ? [`${rest} more`] : [])].join(", ");
  };
  return (
    <div className="space-y-1 text-secondary">
      <p>
        {own ? "Your open" : "Open"} deals expected to close this quarter: {money(m.openClosing)}; closed won so far: {money(m.closedWon)}
        {target ? ` (${Math.round((m.closedWon / target) * 100)}% of the ${money(target)} target)` : ""}.
      </p>
      {sub ? (
        <>
          <p>Submitted {new Date(sub.createdAt).toLocaleString()} with {sub.deals?.length ?? 0} open deal{sub.deals?.length === 1 ? "" : "s"} behind it{sub.deals?.length ? `: ${names(sub.deals.map((d) => d.id))}` : ""}.</p>
          {moved ? (
            <p>
              Since {new Date(moved.since).toLocaleDateString()}: {moved.change === 0 ? "no change" : `${moved.change > 0 ? "up" : "down"} ${money(Math.abs(moved.change))}`}
              {moved.added.length ? `; in: ${names(moved.added)}` : ""}{moved.dropped.length ? `; out: ${names(moved.dropped)}` : ""}.
            </p>
          ) : null}
        </>
      ) : (
        <p>Not submitted yet.</p>
      )}
    </div>
  );
}
