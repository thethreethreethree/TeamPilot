"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * A deal's split (revenue plan phase 10, 0394; Gong F20.12). Shows who shares the deal's revenue and how; the deal's
 * rep (or their manager) changes it: up to four co-owners from the team, whole percents, saved only when they add up
 * to 100 (the database checks it again). "Back to one owner" saves the rep at 100. Splits only change whose number a
 * deal counts toward — not who can see it.
 */
type Share = { userId: string; pct: number };
type Person = { id: string; name: string };

export function DealSplit({ repId, split, busy, post }: { repId: string; split: Share[] | null | undefined; busy: boolean; post: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  // A failed team read is said, never shown as "no one to pick" (noFailedReadAsEmpty).
  const [teamFailed, setTeamFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Share[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/team")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as { members?: Array<{ id: string; full_name?: string | null }> };
      })
      .then((d) => {
        if (live) setPeople((d.members ?? []).map((m) => ({ id: m.id, name: m.full_name ?? "Unnamed teammate" })));
      })
      .catch(() => {
        if (live) setTeamFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  const name = (id: string) => people?.find((p) => p.id === id)?.name ?? "A teammate";
  const current = split && split.length ? split : null;
  const total = rows.reduce((s, r) => s + (Number.isFinite(r.pct) ? r.pct : 0), 0);
  const start = () => {
    setRows(current ?? [{ userId: repId, pct: 100 }]);
    setErr(null);
    setEditing(true);
  };
  const save = async (shares: Share[]) => {
    setErr(null);
    if (await post({ action: "split", shares })) setEditing(false);
  };

  if (split === undefined) return <p className="text-[11px] text-muted">Couldn&apos;t read this deal&apos;s split.</p>;
  return (
    <div className="text-xs" aria-label="Deal split">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Split</p>
      {!editing ? (
        <div className="flex flex-wrap items-center gap-2 text-secondary">
          {current ? current.map((s) => <span key={s.userId} className="rounded-full border border-default px-2 py-0.5 text-primary">{s.userId === repId ? `${name(s.userId)} (rep)` : name(s.userId)} · {s.pct}%</span>) : <span>{name(repId)} owns all of it.</span>}
          <button type="button" disabled={busy} onClick={start} className="text-[11px] underline-offset-2 hover:text-primary hover:underline">{current ? "Change" : "Split this deal"}</button>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {r.userId === repId ? (
                <span className="min-w-[10rem] text-primary">{name(repId)} (rep)</span>
              ) : (
                <select value={r.userId} aria-label={`Owner ${i + 1}`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, userId: e.currentTarget.value } : x)))} className="min-w-[10rem] rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary">
                  <option value="">pick someone…</option>
                  {(people ?? []).filter((p) => p.id === r.userId || !rows.some((x) => x.userId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <input type="number" min={1} max={100} value={r.pct} aria-label={`Share ${i + 1} (%)`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, pct: Math.round(Number(e.currentTarget.value) || 0) } : x)))} className="w-16 rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
              <span className="text-muted">%</span>
              {r.userId !== repId && (
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove owner ${i + 1}`} className="text-muted hover:text-primary"><X className="h-3.5 w-3.5" aria-hidden /></button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {rows.length < 5 && <button type="button" disabled={!people} onClick={() => setRows([...rows, { userId: "", pct: 0 }])} className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary disabled:opacity-50"><Plus className="h-3 w-3" aria-hidden /> Add an owner</button>}
            <span className={total === 100 ? "text-muted" : "text-amber-700 dark:text-amber-300"}>Total {total}%{total === 100 ? "" : " — must be 100"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || total !== 100 || rows.some((r) => !r.userId || r.pct < 1)} onClick={() => void save(rows)} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">Save split</button>
            {current && <button type="button" disabled={busy} onClick={() => void save([{ userId: repId, pct: 100 }])} className="text-[11px] text-secondary hover:text-primary">Back to one owner</button>}
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-muted hover:text-primary">Cancel</button>
          </div>
          {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
          {teamFailed && <p className="text-amber-700 dark:text-amber-300">Couldn&apos;t load your team, so owners can&apos;t be picked. Refresh to try again.</p>}
          <p className="text-[11px] text-muted">The forecast counts each owner&apos;s share. Who can see the deal doesn&apos;t change.</p>
        </div>
      )}
    </div>
  );
}
