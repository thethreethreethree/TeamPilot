"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, CalendarPlus, CheckCircle2, CalendarDays, AlertTriangle, Sparkles } from "lucide-react";
import type { Employee } from "@/lib/schedule/types";
import { describeViolation } from "@/lib/schedule/assignEval";
import type { AssignmentImpact } from "@/lib/schedule/assignEval";
import type { ResolutionCandidate } from "@/lib/schedule/resolution";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — manual shift builder (Phase 5 completion). Create a shift by hand (date +
 * times + how many are needed) and assign staff to it, WITHOUT importing a file — fulfilling the grid
 * empty-state's "or build a schedule". Form-based, consistent with the other schedule surfaces.
 *
 * Flow: append one SHIFT_DEFINED (a generated shiftId), then one EMPLOYEE_ASSIGNED per selected staff, via
 * the manager-gated events route. Incremental by design — the shift exists first, then people are added to
 * it; each EMPLOYEE_ASSIGNED is independent + idempotent (the projector de-dupes). Honest errors; the
 * success card offers the next step (view the grid / build another).
 */

type Done = { assigned: number; total: number };

export default function ScheduleBuildPage() {
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, string[]>>({}); // employeeId -> conflict reasons
  const [suggestions, setSuggestions] = useState<ResolutionCandidate[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/employees");
      if (res.ok) setRoster(((await res.json()).employees ?? []).filter((e: Employee) => e.status === "active"));
    } catch { /* the form still works; assignment just has no roster to pick from */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const canCreate = !!date && hhmm.test(start) && hhmm.test(end) && Number(headcount) >= 1 && !busy;

  // Surface assignment conflicts BEFORE creating (the plan: evaluate changes + surface impact). Debounced;
  // reuses the authority server-side. Manager-overridable — this warns, it doesn't block the create.
  useEffect(() => {
    if (!date || !hhmm.test(start) || !hhmm.test(end) || selected.size === 0) { setConflicts({}); return; }
    const ids = [...selected];
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/schedule/assign/evaluate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, start, end, requiredHeadcount: Number(headcount) || 0, employeeIds: ids }),
        });
        if (!res.ok) { setConflicts({}); return; }
        const { impacts } = (await res.json()) as { impacts: AssignmentImpact[] };
        const map: Record<string, string[]> = {};
        for (const im of impacts) if (im.violations.length > 0) map[im.employeeId] = im.violations.map(describeViolation);
        setConflicts(map);
      } catch { setConflicts({}); }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, start, end, headcount, selected]);

  const canSuggest = !!date && hhmm.test(start) && hhmm.test(end) && !suggesting;
  const suggest = async () => {
    if (!canSuggest) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/schedule/assign/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, start, end, requiredHeadcount: Number(headcount) || 0 }),
      });
      setSuggestions(res.ok ? ((await res.json()).candidates ?? []) : []);
    } catch { setSuggestions([]); }
    finally { setSuggesting(false); }
  };

  const reset = () => {
    setDone(null); setError(null);
    setDate(""); setStart(""); setEnd(""); setHeadcount("1"); setSelected(new Set()); setConflicts({}); setSuggestions(null);
  };

  const create = async () => {
    if (busyRef.current || !canCreate) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const shiftId = crypto.randomUUID();
    const post = (type: string, payload: Record<string, unknown>) =>
      fetch("/api/schedule/events", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, payload }),
      });
    try {
      const shiftRes = await post("SHIFT_DEFINED", { shiftId, date, start, end, requiredHeadcount: Number(headcount) });
      if (!shiftRes.ok) {
        setError(shiftRes.status === 403 ? "Only a manager can build the schedule." : "Couldn't create the shift.");
        return;
      }
      // Assign each selected staff. Incremental — a failure leaves the shift + prior assignments intact.
      const ids = [...selected];
      let ok = 0;
      for (const employeeId of ids) {
        const r = await post("EMPLOYEE_ASSIGNED", { shiftId, employeeId });
        if (r.ok) ok += 1;
      }
      if (ok < ids.length) setError(`Shift created, but ${ids.length - ok} assignment(s) failed — open the shift to retry.`);
      setDone({ assigned: ok, total: ids.length });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <CalendarPlus className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Build a Shift</h1>
      </div>
      <p className="text-xs text-muted mb-5">Create a shift by hand and assign staff — no file needed.</p>

      {done ? (
        <div className="glass-card p-5 border border-emerald-500/30 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
              <CheckCircle2 className="w-5 h-5" aria-hidden /> Shift created
            </div>
            <p className="text-sm text-secondary">{done.assigned} of {done.total} staff assigned.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/schedule/grid"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden /> View the schedule
            </Link>
            <button type="button" onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary">
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden /> Build another
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-muted">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            </label>
            <label className="text-xs text-muted">Needed (headcount)
              <input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            </label>
            <label className="text-xs text-muted">Start
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            </label>
            <label className="text-xs text-muted">End <span className="text-muted/70">(may cross midnight)</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted">Assign staff (optional)</div>
              <button type="button" onClick={suggest} disabled={!canSuggest}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline disabled:opacity-40 disabled:no-underline">
                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Sparkles className="w-3 h-3" aria-hidden />}
                Suggest who's free
              </button>
            </div>
            {suggestions !== null && (
              suggestions.length === 0 ? (
                <p className="text-[11px] text-muted mb-2">No one is free for this shift (everyone is off, over hours, ineligible, or already booked).</p>
              ) : (
                <div className="mb-2 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2">
                  <p className="text-[11px] text-muted mb-1">Available, least-loaded first — click to add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.filter((c) => !selected.has(c.employeeId)).map((c) => (
                      <button key={c.employeeId} type="button" onClick={() => toggle(c.employeeId)}
                        title={`${c.currentHours}h this week`}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-brand/40 bg-surface text-brand hover:bg-brand/10">
                        + {c.name} <span className="text-muted">({c.currentHours}h)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading roster…</div>
            ) : roster.length === 0 ? (
              <p className="text-xs text-muted">No active staff. Add staff on the Roster tab, or create the shift now and assign later.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {roster.map((e) => {
                  const hasConflict = selected.has(e.id) && (conflicts[e.id]?.length ?? 0) > 0;
                  return (
                    <button key={e.id} type="button" onClick={() => toggle(e.id)}
                      title={hasConflict ? `${e.name}: ${conflicts[e.id]!.join("; ")}` : undefined}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                        selected.has(e.id)
                          ? hasConflict ? "bg-amber-400/20 text-amber-300 border-amber-400/60 font-semibold" : "bg-brand text-black border-transparent font-semibold"
                          : "bg-surface border-white/10 text-secondary"
                      }`}>
                      {hasConflict && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden />}
                      {e.name}
                    </button>
                  );
                })}
              </div>
            )}
            {Object.keys(conflicts).length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 space-y-0.5">
                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" aria-hidden /> Conflicts (you can still create — these are warnings)</p>
                {Object.entries(conflicts).map(([id, reasons]) => (
                  <p key={id} className="text-[11px] text-amber-300/90">
                    <span className="font-medium">{roster.find((e) => e.id === id)?.name ?? id}</span>: {reasons.join("; ")}
                  </p>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button type="button" onClick={create} disabled={!canCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <CalendarPlus className="w-3.5 h-3.5" aria-hidden />}
            Create shift{selected.size > 0 ? ` + assign ${selected.size}` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
