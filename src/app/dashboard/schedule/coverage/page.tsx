"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Plus } from "lucide-react";
import type { CoverageRequirement } from "@/lib/schedule/types";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — coverage requirements editor (Phase 5). Set the "no lapse" rules the System
 * checks when it evaluates a change: the minimum headcount for a day (or a time window). Event-sourced;
 * manager-only. Without a requirement, a change shows no coverage impact — this is where the floors come from.
 */

type Form = { appliesTo: "day" | "shift" | "role"; minHeadcount: string; start: string; end: string };
const EMPTY: Form = { appliesTo: "day", minHeadcount: "", start: "", end: "" };

export default function CoveragePage() {
  const [reqs, setReqs] = useState<CoverageRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Synchronous double-submit latch — the `saving` state check is read at render time, so two fast clicks
  // both see saving === false and both POST (duplicate requirement). A ref flips synchronously.
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/schedule/coverage");
      if (res.ok) setReqs((await res.json()).requirements ?? []);
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = Number(form.minHeadcount);
    if (!form.minHeadcount.trim() || Number.isNaN(min) || min < 0 || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/schedule/coverage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliesTo: form.appliesTo,
          minHeadcount: min,
          ...(form.start && form.end ? { timeWindow: { start: form.start, end: form.end } } : {}),
        }),
      });
      if (res.status === 201) { setForm(EMPTY); await load(); }
      else if (res.status === 403) setFormError("Only a manager can set coverage.");
      else setFormError("Couldn't save. Try again.");
    } catch { setFormError("Couldn't reach the server."); }
    finally { setSaving(false); savingRef.current = false; }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Coverage Requirements</h1>
      </div>
      <p className="text-xs text-muted mb-5">The minimum staffing the System protects. Time off that would drop below these is flagged before you approve it.</p>

      <form onSubmit={submit} className="glass-card p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-secondary"><Plus className="w-4 h-4" aria-hidden /> Add a requirement</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={form.appliesTo} onChange={(e) => setForm((f) => ({ ...f, appliesTo: e.target.value as Form["appliesTo"] }))}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
            <option value="day">Every day</option>
            <option value="shift">Per shift</option>
            <option value="role">Per role</option>
          </select>
          <input value={form.minHeadcount} onChange={(e) => setForm((f) => ({ ...f, minHeadcount: e.target.value }))}
            placeholder="Minimum people" inputMode="numeric"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          <input value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            placeholder="From (HH:mm, optional)"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          <input value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
            placeholder="To (HH:mm, optional)"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
        </div>
        {formError && <p className="text-xs text-red-300">{formError}</p>}
        <button type="submit" disabled={!form.minHeadcount.trim() || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Plus className="w-3.5 h-3.5" aria-hidden />}
          Add
        </button>
      </form>

      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">Couldn&apos;t load coverage requirements. Try again.</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-brand hover:underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…</div>
      ) : reqs.length === 0 ? (
        <p className="text-sm text-muted">No coverage requirements yet. Add one above so the System can protect your minimum staffing.</p>
      ) : (
        <ul className="space-y-2">
          {reqs.map((r) => (
            <li key={r.id} className="glass-card p-3.5 text-sm text-primary">
              At least <span className="font-semibold">{r.minHeadcount}</span>{" "}
              {r.appliesTo === "day" ? "every day" : r.appliesTo === "shift" ? "per shift" : "per role"}
              {r.timeWindow && <span className="text-muted"> · {r.timeWindow.start} to {r.timeWindow.end}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
