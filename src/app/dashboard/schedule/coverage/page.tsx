"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Plus, AlertTriangle } from "lucide-react";
import type { CoverageRequirement } from "@/lib/schedule/types";
import type { ShiftCoverageGap } from "@/lib/schedule/coverageStatus";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — coverage requirements editor (Phase 5). Set the "no lapse" rules the System
 * checks when it evaluates a change: the minimum headcount for a day (or a time window). Event-sourced;
 * manager-only. Without a requirement, a change shows no coverage impact — this is where the floors come from.
 */

type Form = { appliesTo: "day" | "shift" | "role"; minHeadcount: string; role: string; start: string; end: string };
const EMPTY: Form = { appliesTo: "day", minHeadcount: "", role: "", start: "", end: "" };
type Candidate = { employeeId: string; name: string; currentHours: number };
type GapWithCandidates = ShiftCoverageGap & { candidates?: Candidate[] };

export default function CoveragePage() {
  const [reqs, setReqs] = useState<CoverageRequirement[]>([]);
  const [gaps, setGaps] = useState<GapWithCandidates[]>([]);
  const [covering, setCovering] = useState<string | null>(null);
  const coverRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Synchronous double-submit latch — the `saving` state check is read at render time, so two fast clicks
  // both see saving === false and both POST (duplicate requirement). A ref flips synchronously.
  const savingRef = useRef(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removingRef = useRef<Set<string>>(new Set()); // per-id double-submit latch (RQ13 class)

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/schedule/coverage");
      if (res.ok) { const j = await res.json(); setReqs(j.requirements ?? []); setGaps(j.gaps ?? []); }
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Fill a gap in place: assign a suggested candidate to the short shift, then reload so the gap updates
  // (closes the proactive-gap → action loop). Re-entrancy-latched.
  const fillGap = async (shiftId: string, c: Candidate) => {
    if (coverRef.current) return;
    coverRef.current = true;
    setCovering(`${shiftId}:${c.employeeId}`);
    try {
      const res = await fetch("/api/schedule/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId, employeeId: c.employeeId } }),
      });
      if (res.ok) await load(); // reload — the gap shrinks or disappears
    } catch { /* leave the gap; the manager can retry */ }
    finally { coverRef.current = false; setCovering(null); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = Number(form.minHeadcount);
    const isRole = form.appliesTo === "role";
    if (!form.minHeadcount.trim() || Number.isNaN(min) || min < 0 || saving || savingRef.current) return;
    if (isRole && !form.role.trim()) { setFormError("Name the role this requirement is for."); return; }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/schedule/coverage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliesTo: form.appliesTo,
          minHeadcount: min,
          // "role" mode: the count is a floor for that specific role (minByRole); the backend + authority
          // enforce it. Multiple roles = multiple requirements (they combine — RQ20).
          ...(isRole ? { minByRole: { [form.role.trim()]: min } } : {}),
          ...(form.start && form.end ? { timeWindow: { start: form.start, end: form.end } } : {}),
        }),
      });
      if (res.status === 201) { setForm(EMPTY); await load(); }
      else if (res.status === 403) setFormError("Only a manager can set coverage.");
      else setFormError("Couldn't save. Try again.");
    } catch { setFormError("Couldn't reach the server."); }
    finally { setSaving(false); savingRef.current = false; }
  };

  const remove = async (id: string) => {
    if (removingRef.current.has(id)) return;
    removingRef.current.add(id);
    setRemovingId(id);
    setFormError(null);
    try {
      const res = await fetch(`/api/schedule/coverage?requirementId=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await load();
      else setFormError(res.status === 403 ? "Only a manager can remove coverage." : "Couldn't remove it. Try again.");
    } catch { setFormError("Couldn't reach the server."); }
    finally { setRemovingId(null); removingRef.current.delete(id); }
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
            placeholder={form.appliesTo === "role" ? "How many of this role" : "Minimum people"} inputMode="numeric"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          {form.appliesTo === "role" && (
            <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Role (e.g. nurse)"
              className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
          )}
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

      {/* Current gaps: shifts understaffed RIGHT NOW (proactive) — before you even review a time-off. */}
      {gaps.length > 0 && (
        <div className="glass-card p-4 mb-6 border border-brand/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand mb-2">
            <AlertTriangle className="w-4 h-4" aria-hidden /> {gaps.length} shift{gaps.length > 1 ? "s" : ""} short right now
          </div>
          <ul className="space-y-1.5">
            {gaps.map((g) => (
              <li key={g.shiftId} className="text-xs text-secondary">
                <div className="flex items-center justify-between gap-3">
                  <span>{g.date} · {g.start} to {g.end} · <span className="text-muted">{g.assigned} on it</span></span>
                  <span className="text-brand">
                    {g.gaps.map((d) => (d.kind === "headcount" ? `${d.need} more` : `${d.need} more ${d.role}`)).join(", ")}
                  </span>
                </div>
                {/* Fill in place — the candidates are eligible + conflict-free + fair-load ranked (findResolutions). */}
                {g.candidates && g.candidates.length > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted">Fill with:</span>
                    {g.candidates.map((c) => {
                      const isCovering = covering === `${g.shiftId}:${c.employeeId}`;
                      return (
                        <button key={c.employeeId} type="button" onClick={() => void fillGap(g.shiftId, c)} disabled={isCovering}
                          title={`Assign ${c.name} (${c.currentHours}h this week) to this shift`}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-brand/40 bg-surface text-brand hover:bg-brand/10 disabled:opacity-50">
                          {isCovering ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <span>+</span>}
                          {c.name} <span className="text-muted">({c.currentHours}h)</span>
                        </button>
                      );
                    })}
                  </div>
                ) : g.candidates ? (
                  <p className="text-[11px] text-muted mt-1">No one is free to fill this (all off / over hours / ineligible / already booked).</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <li key={r.id} className="glass-card p-3.5 text-sm text-primary flex items-center justify-between gap-3">
              <span>
                {Object.keys(r.minByRole).length > 0 ? (
                  <>At least{" "}
                    <span className="font-semibold">
                      {Object.entries(r.minByRole).map(([role, n]) => `${n} ${role}`).join(", ")}
                    </span>{" "}per shift</>
                ) : (
                  <>At least <span className="font-semibold">{r.minHeadcount}</span>{" "}
                    {r.appliesTo === "day" ? "every day" : r.appliesTo === "shift" ? "per shift" : "per role"}</>
                )}
                {r.timeWindow && <span className="text-muted"> · {r.timeWindow.start} to {r.timeWindow.end}</span>}
              </span>
              <button type="button" onClick={() => void remove(r.id)} disabled={removingId === r.id}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-white/10 text-secondary disabled:opacity-50">
                {removingId === r.id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
