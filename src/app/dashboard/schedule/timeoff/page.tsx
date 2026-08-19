"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import type { Employee } from "@/lib/schedule/types";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — time-off review (Phase 5/6). A manager records a staff time-off request,
 * sees the DETERMINISTIC coverage impact + who could fill any gap + an advisory AI recommendation, then
 * approves or denies. The System proposes; the manager decides (§3.3). Nothing is decided until you click.
 */

type Candidate = { employeeId: string; name: string; currentHours: number };
type TimeOffRow = { id: string; employeeName: string; type: string; start: string; end: string; status: string };
type Evaluation = {
  verdict: { approvable: boolean; autoApprovable: boolean; violations: { kind: string }[]; reason: string };
  resolutionsByShift: { shiftId: string; candidates: Candidate[] }[];
  proposal: string | null;
};

export default function TimeOffReviewPage() {
  const [roster, setRoster] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("vacation");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState<null | "eval" | "decide">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([]);
  const [covering, setCovering] = useState<string | null>(null); // `${shiftId}:${employeeId}` being assigned
  const [covered, setCovered] = useState<Set<string>>(new Set()); // candidates assigned to cover, this eval
  const coverRef = useRef(false);

  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/employees");
      if (res.ok) {
        const d = await res.json();
        setRoster((d.employees ?? []).filter((e: Employee) => e.status === "active"));
      }
    } catch { /* the picker just stays empty; the form still guards on employeeId */ }
  }, []);
  const loadTimeOff = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/timeoff");
      if (res.ok) setTimeOff((await res.json()).timeOff ?? []);
    } catch { /* the list just stays empty */ }
  }, []);
  useEffect(() => { void loadRoster(); void loadTimeOff(); }, [loadRoster, loadTimeOff]);

  const canEval = employeeId && start && end && busy === null;

  // Any input change invalidates a prior evaluation: a decision must act on a FRESH evaluation of the
  // CURRENT inputs, never a stale verdict computed for a different employee/date range. Without this, a
  // manager could change the staff member after evaluating and approve on the old verdict (state-bleed).
  const clearEval = () => { setEvaluation(null); setDone(null); setCovered(new Set()); };

  // One-click cover: assign a proposed candidate to the gapped shift (close the propose→act loop — the plan
  // proposes WHO could cover; this lets the manager act on it without a separate rebuild). Appends
  // EMPLOYEE_ASSIGNED via the manager-gated events route. Re-entrancy-latched.
  const assignCover = async (shiftId: string, c: Candidate) => {
    if (coverRef.current) return;
    coverRef.current = true;
    setCovering(`${shiftId}:${c.employeeId}`);
    setError(null);
    try {
      const res = await fetch("/api/schedule/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId, employeeId: c.employeeId } }),
      });
      if (!res.ok) { setError(`Couldn't assign ${c.name} to cover. Try again.`); return; }
      setCovered((s) => new Set(s).add(`${shiftId}:${c.employeeId}`));
    } catch {
      setError(`Couldn't assign ${c.name} to cover. Try again.`);
    } finally {
      coverRef.current = false;
      setCovering(null);
    }
  };

  // Synchronous double-submit latch for the decision write (a busy-STATE guard can double-fire before the
  // re-render disables the button).
  const decidingRef = useRef(false);

  const evaluate = async () => {
    if (!canEval) return;
    setBusy("eval");
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/schedule/timeoff/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, start, end }),
      });
      if (!res.ok) { setError("Couldn't evaluate the request. Check the dates and try again."); return; }
      setEvaluation(await res.json());
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); }
  };

  const decide = async (decision: "approve" | "deny") => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setBusy("decide");
    setError(null);
    try {
      const res = await fetch("/api/schedule/timeoff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, type, start, end, decision }),
      });
      if (res.status === 201) { setDone(decision === "approve" ? "Approved" : "Denied"); setEvaluation(null); void loadTimeOff(); }
      else if (res.status === 403) { setError("Only a manager can record time off."); }
      else { setError("Couldn't record the decision. Try again."); }
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(null); decidingRef.current = false; }
  };

  const v = evaluation?.verdict;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Time Off</h1>
      </div>
      <p className="text-xs text-muted mb-5">Record a request and see its coverage impact before you decide.</p>

      <div className="glass-card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); clearEval(); }}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
            <option value="">Select staff…</option>
            {roster.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); clearEval(); }}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
            <option value="vacation">Vacation</option>
            <option value="sick">Sick</option>
            <option value="personal">Personal</option>
            <option value="day_off">Day off</option>
          </select>
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); clearEval(); }}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
          <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); clearEval(); }}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
        </div>
        <button type="button" onClick={evaluate} disabled={!canEval}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {busy === "eval" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Sparkles className="w-3.5 h-3.5" aria-hidden />}
          Evaluate impact
        </button>
      </div>

      {done && (
        <div className="glass-card p-4 mb-4 border border-emerald-500/30 text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" aria-hidden /> {done}.
        </div>
      )}

      {v && (
        <div className="glass-card p-4 mb-4 space-y-3">
          <p className={`text-sm font-semibold ${v.autoApprovable ? "text-emerald-400" : v.approvable ? "text-brand" : "text-red-300"}`}>
            {v.autoApprovable ? "No coverage impact — safe to approve." : v.approvable ? "Approvable, with a coverage trade-off." : "Blocked by a hard conflict."}
          </p>
          <p className="text-xs text-muted">{v.reason}</p>

          {evaluation!.resolutionsByShift.length > 0 && (
            <div className="text-xs text-secondary">
              <div className="font-semibold mb-1">Who could cover the gap:</div>
              {evaluation!.resolutionsByShift.map((r) => (
                <div key={r.shiftId} className="mb-1">
                  {r.candidates.length === 0 ? (
                    <span className="text-muted">No one is free and eligible for one shift.</span>
                  ) : (
                    r.candidates.slice(0, 5).map((c) => {
                      const key = `${r.shiftId}:${c.employeeId}`;
                      const isCovered = covered.has(key);
                      const isCovering = covering === key;
                      return (
                        <button key={c.employeeId} type="button"
                          onClick={() => !isCovered && void assignCover(r.shiftId, c)}
                          disabled={isCovered || isCovering}
                          title={isCovered ? `${c.name} assigned to cover` : `Assign ${c.name} to cover this shift`}
                          className={`inline-flex items-center gap-1 mr-2 mb-1 rounded px-2 py-0.5 border ${
                            isCovered ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-surface border-brand/30 text-secondary hover:bg-brand/10"
                          }`}>
                          {isCovering ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : isCovered ? <CheckCircle2 className="w-3 h-3" aria-hidden /> : <span className="text-brand">+</span>}
                          {c.name} <span className="text-muted">({c.currentHours}h)</span>{isCovered ? " · covering" : ""}
                        </button>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          )}

          {evaluation!.proposal && (
            <p className="text-sm text-secondary bg-surface rounded-lg p-3 leading-relaxed">{evaluation!.proposal}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => void decide("approve")} disabled={!v.approvable || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {busy === "decide" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
              {v.autoApprovable ? "Approve" : "Approve anyway"}
            </button>
            <button type="button" onClick={() => void decide("deny")} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" aria-hidden /> Deny
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}

      {/* Recorded time off — who is off / pending, so a manager has the picture without evaluating each one. */}
      {timeOff.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-semibold text-secondary mb-2">Recorded time off</div>
          <ul className="space-y-1.5">
            {timeOff.map((t) => (
              <li key={t.id} className="glass-card p-3 text-xs flex items-center justify-between gap-3">
                <span className="text-primary truncate">
                  <span className="font-semibold">{t.employeeName}</span>
                  <span className="text-muted"> · {t.type} · {t.start}{t.end !== t.start ? ` to ${t.end}` : ""}</span>
                </span>
                <span className={t.status === "approved" ? "text-emerald-400" : t.status === "denied" ? "text-muted line-through" : "text-brand"}>
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
