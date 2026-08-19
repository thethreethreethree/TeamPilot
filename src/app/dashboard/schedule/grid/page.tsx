"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import type { Employee, ScheduleState } from "@/lib/schedule/types";
import { weekStartOf, addDaysIso } from "@/lib/schedule/constraints";
import { todayInTz, DEFAULT_SCHEDULE_SETTINGS, type ScheduleSettings } from "@/lib/schedule/settings";
import { buildWeekGrid, relevantRows } from "@/lib/schedule/gridView";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — the grid schedule view (Phase 5, the founder's chosen primary layout).
 * Staff down the side, the WEEK's dates across the top, each cell the shift that person works that day.
 *
 * Weekly view with prev/next navigation (default: the current week). This bounds the grid to 7 columns —
 * without it the grid grew a column per date ever as the append-only log accumulated (an unusably wide
 * grid over time) — while keeping history reachable (navigate to a past week). Reads the derived state
 * (events -> projector) + the roster. Read-only for now (editing a shift is a sibling surface).
 */

type EventsResponse = { state: ScheduleState };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The browser's LOCAL date as YYYY-MM-DD (getFullYear/Month/Date — NOT toISOString, which is UTC and can be
 *  off by a day near midnight). */
function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? "";
}

export default function ScheduleGridPage() {
  const [state, setState] = useState<ScheduleState | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [weekStart, setWeekStart] = useState<string>(() => weekStartOf(localTodayIso()) ?? localTodayIso());
  const initialWeekSet = useRef(false); // set the default week from settings ONCE (a reload must not jump off a navigated week)

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ev, emp, set] = await Promise.all([
        fetch("/api/schedule/events"),
        fetch("/api/schedule/employees"),
        fetch("/api/schedule/settings"), // non-critical: falls back to defaults below
      ]);
      if (!ev.ok || !emp.ok) { setError(true); return; }
      const evd: EventsResponse = await ev.json();
      const empd: { employees: Employee[] } = await emp.json();
      setState(evd.state);
      setRoster(empd.employees ?? []);
      const s: ScheduleSettings = set.ok ? await set.json() : DEFAULT_SCHEDULE_SETTINGS;
      setSettings(s);
      // Align the default week to the company's workweek-start + timezone — but only ONCE, so a reload
      // (e.g. after an unassign) never yanks the manager back off a week they navigated to.
      if (!initialWeekSet.current) {
        initialWeekSet.current = true;
        const today = todayInTz(s.timezone);
        setWeekStart(weekStartOf(today, s.workweekStart) ?? today);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // The 7 dates of the selected week (Mon-Sun).
  const dates = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].map((n) => addDaysIso(weekStart, n)).filter((d): d is string => d !== null),
    [weekStart],
  );

  // Pivot the derived shifts into an employee×date lookup for the displayed week (pure logic in gridView.ts,
  // unit-tested there). Each cell carries the shiftId so a click can unassign that person from THAT shift.
  const { cell, shiftsThisWeek, emptyShiftsThisWeek, scheduledIds } = useMemo(
    () => buildWeekGrid(state ? Object.values(state.shifts) : [], dates),
    [state, dates],
  );

  // Rows = active staff + anyone actually working this week (deactivated-and-unscheduled staff are hidden so
  // their empty rows don't pile up). Pure + unit-tested in gridView.ts.
  const rows = useMemo(() => relevantRows(roster, scheduledIds), [roster, scheduledIds]);

  // Cell-click unassign: click a shift cell -> confirm -> append EMPLOYEE_UNASSIGNED (manager-gated route) ->
  // reload. The grid IS the natural selector (the person is shown right where you click). busyRef is a
  // re-entrancy latch (a double-click must not double-append); `unassigning` drives the per-cell spinner.
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const unassign = useCallback(async (shiftId: string, empId: string, empName: string) => {
    if (busyRef.current) return;
    if (typeof window !== "undefined" && !window.confirm(`Unassign ${empName} from this shift?`)) return;
    busyRef.current = true;
    setActionError(null);
    setUnassigning(`${shiftId}:${empId}`);
    try {
      const res = await fetch("/api/schedule/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMPLOYEE_UNASSIGNED", payload: { shiftId, employeeId: empId } }),
      });
      // A single-action failure shows a light dismissible banner — it must NOT nuke the whole grid to the
      // full-screen error card (that would lose the manager's view for a transient click failure).
      if (!res.ok) { setActionError(`Couldn't unassign ${empName}. Try again.`); return; }
      await load();
    } catch {
      setActionError(`Couldn't unassign ${empName}. Try again.`);
    } finally {
      busyRef.current = false;
      setUnassigning(null);
    }
  }, [load]);

  const dayLabel = (iso: string) => { const [, m, d] = iso.split("-"); return `${m}/${d}`; };
  const shiftWeek = (n: number) => setWeekStart((w) => addDaysIso(w, n) ?? w);
  const goToday = () => { const t = todayInTz(settings.timezone); setWeekStart(weekStartOf(t, settings.workweekStart) ?? t); };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-full mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Schedule</h1>
      </div>
      <p className="text-xs text-muted mb-4">Who works when. Click a shift to unassign someone; import a schedule or build shifts to add them.</p>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => shiftWeek(-7)} aria-label="Previous week"
          className="inline-flex items-center rounded-lg bg-surface border border-white/10 p-1.5 text-secondary">
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
        <span className="text-sm font-semibold text-primary tabular-nums">Week of {weekStart}</span>
        <button type="button" onClick={() => shiftWeek(7)} aria-label="Next week"
          className="inline-flex items-center rounded-lg bg-surface border border-white/10 p-1.5 text-secondary">
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
        <button type="button" onClick={goToday} className="text-xs font-semibold text-brand hover:underline ml-1">This week</button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <span className="text-xs text-red-300">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-xs font-semibold text-red-300 hover:underline">Dismiss</button>
        </div>
      )}

      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">Couldn&apos;t load the schedule. This is an error, not an empty schedule. Try again.</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-brand hover:underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading schedule…
        </div>
      ) : roster.length === 0 ? (
        <p className="text-sm text-muted">Nothing scheduled yet. Add staff to the roster and import or build a schedule to see the grid here.</p>
      ) : (
        <>
          {shiftsThisWeek === 0 && <p className="text-xs text-muted mb-2">No shifts this week — use the arrows to find a week with shifts, or Build / Import one.</p>}
          {emptyShiftsThisWeek > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-300 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              {emptyShiftsThisWeek} shift{emptyShiftsThisWeek === 1 ? " has" : "s have"} no one assigned this week (not shown in the grid) — assign staff on Build, or see Coverage for the gaps.
            </p>
          )}
          <div className="overflow-x-auto glass-card p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-secondary px-3 py-2 border-b border-white/10 min-w-[9rem]">Name</th>
                  {dates.map((d) => (
                    <th key={d} className="text-center text-[11px] font-semibold text-secondary px-2 py-2 border-b border-white/10 whitespace-nowrap tabular-nums">
                      <div className="text-muted">{weekdayOf(d)}</div>
                      {dayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((emp) => (
                  <tr key={emp.id}>
                    <td className="sticky left-0 bg-base text-primary text-xs px-3 py-2 border-b border-white/5 truncate min-w-[9rem]">{emp.name}</td>
                    {dates.map((d) => {
                      const c = cell(emp.id, d);
                      const busy = c !== null && unassigning === `${c.shiftId}:${emp.id}`;
                      return (
                        <td key={d} className={`text-center text-[11px] px-2 py-2 border-b border-white/5 whitespace-nowrap tabular-nums ${c ? "text-primary" : "text-muted/40"}`}>
                          {c ? (
                            <button
                              type="button"
                              onClick={() => unassign(c.shiftId, emp.id, emp.name)}
                              disabled={busy}
                              title={`Unassign ${emp.name} from this shift`}
                              className="rounded px-1.5 py-0.5 hover:bg-white/10 disabled:opacity-50 transition-colors"
                            >
                              {busy ? "…" : c.label}
                            </button>
                          ) : (
                            "·"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
