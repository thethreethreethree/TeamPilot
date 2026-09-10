"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Loader2, Check } from "lucide-react";

/**
 * RepGoalPanel — a manager sets a rep's DAILY SALES GOAL (door home screen, Q1: manager sets it per rep).
 * The goal is what the door target works back from. Manager-only surface (mirrors QuotaTargetPanel). Writes
 * rep_daily_sales_goal via PATCH /api/coach/doorlog/rep-goal; the RLS + the route gate enforce manager-only.
 */

type Member = { id: string; full_name: string | null };

export function RepGoalPanel() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [repId, setRepId] = useState<string>("");
  const [value, setValue] = useState<string>("");
  // Dollar value per sale (for the door screen's cash box). Stored in cents; edited here in whole dollars.
  const [saleValue, setSaleValue] = useState<string>("");
  const [loadingGoal, setLoadingGoal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/coach/sales-session/team")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers((d.members ?? []) as Member[]))
      .catch(() => setMembers([]));
  }, []);

  const loadGoal = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingGoal(true); setSaved(false); setError(null);
    try {
      const res = await fetch(`/api/coach/doorlog/rep-goal?repId=${encodeURIComponent(id)}`);
      const d = res.ok ? await res.json() : { salesGoal: null, saleValueCents: null };
      setValue(d.salesGoal != null ? String(d.salesGoal) : "");
      setSaleValue(d.saleValueCents != null ? String(d.saleValueCents / 100) : "");
    } catch { setValue(""); setSaleValue(""); } finally { setLoadingGoal(false); }
  }, []);

  const onPick = (id: string) => { setRepId(id); void loadGoal(id); };

  const save = useCallback(async () => {
    setError(null); setSaved(false);
    const n = Number(value.trim());
    if (!repId) { setError("Pick a rep first."); return; }
    if (!Number.isInteger(n) || n <= 0) { setError("Enter a whole number of sales, 1 or more."); return; }
    // $-per-sale is optional: blank clears it (null); otherwise dollars → cents.
    const sv = saleValue.trim();
    let saleValueCents: number | null = null;
    if (sv !== "") {
      const dv = Number(sv);
      if (!Number.isFinite(dv) || dv < 0) { setError("Enter a valid dollar amount per sale, or leave it blank."); return; }
      saleValueCents = Math.round(dv * 100);
    }
    setSaving(true);
    try {
      const res = await fetch("/api/coach/doorlog/rep-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId, salesGoal: n, saleValueCents }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? "Couldn't save the goal.");
      } else { setSaved(true); }
    } catch { setError("Couldn't reach the server."); } finally { setSaving(false); }
  }, [repId, value, saleValue]);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Daily sales goal (per rep)</h2>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        The rep&apos;s door tracker works its daily door target back from this. Set how many sales a day you
        expect from each rep.
      </p>

      <div className="flex flex-col gap-2">
        <select
          value={repId}
          onChange={(e) => onPick(e.target.value)}
          className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
        >
          <option value="">{members === null ? "Loading team…" : "Choose a rep…"}</option>
          {(members ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.full_name ?? "Unnamed"}</option>
          ))}
        </select>

        {repId && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={value}
                disabled={loadingGoal}
                onChange={(e) => { setValue(e.target.value); setSaved(false); }}
                placeholder={loadingGoal ? "…" : "e.g. 2"}
                className="w-24 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary tabular-nums"
              />
              <span className="text-xs text-muted">sales / day</span>
            </div>
            {/* $-per-sale (optional) — powers the door screen's "Earned today" cash box. Blank = no dollars shown. */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={saleValue}
                disabled={loadingGoal}
                onChange={(e) => { setSaleValue(e.target.value); setSaved(false); }}
                placeholder={loadingGoal ? "…" : "e.g. 185"}
                className="w-24 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary tabular-nums"
              />
              <span className="text-xs text-muted">per sale (optional)</span>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || loadingGoal}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
                {saved ? "Saved" : "Save goal"}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-amber-600 dark:text-amber-300">{error}</p>}
    </section>
  );
}
