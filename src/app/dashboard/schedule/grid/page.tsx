"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Employee, ScheduleState } from "@/lib/schedule/types";
import { weekStartOf, addDaysIso } from "@/lib/schedule/constraints";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [weekStart, setWeekStart] = useState<string>(() => weekStartOf(localTodayIso()) ?? localTodayIso());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ev, emp] = await Promise.all([fetch("/api/schedule/events"), fetch("/api/schedule/employees")]);
      if (!ev.ok || !emp.ok) { setError(true); return; }
      const evd: EventsResponse = await ev.json();
      const empd: { employees: Employee[] } = await emp.json();
      setState(evd.state);
      setRoster(empd.employees ?? []);
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

  // Pivot the derived shifts: employeeId -> date -> "HH:mm-HH:mm".
  const { cellFor, shiftsThisWeek, scheduledIds } = useMemo(() => {
    const shifts = state ? Object.values(state.shifts) : [];
    const inWeek = dates.length > 0 ? new Set(dates) : new Set<string>();
    const byEmpDate = new Map<string, Map<string, string>>();
    let count = 0;
    for (const s of shifts) {
      if (!inWeek.has(s.date)) continue;
      count += 1;
      for (const empId of s.assigned) {
        if (!byEmpDate.has(empId)) byEmpDate.set(empId, new Map());
        byEmpDate.get(empId)!.set(s.date, `${s.start}-${s.end}`);
      }
    }
    return {
      cellFor: (empId: string, date: string) => byEmpDate.get(empId)?.get(date) ?? "",
      shiftsThisWeek: count,
      scheduledIds: new Set(byEmpDate.keys()),
    };
  }, [state, dates]);

  // Rows = active staff + anyone actually working this week (a deactivated staff member with a shift still
  // shows). Deactivated staff with no shift this week are hidden — otherwise their empty rows pile up.
  const rows = useMemo(
    () => roster.filter((e) => e.status === "active" || scheduledIds.has(e.id)),
    [roster, scheduledIds],
  );

  const dayLabel = (iso: string) => { const [, m, d] = iso.split("-"); return `${m}/${d}`; };
  const shiftWeek = (n: number) => setWeekStart((w) => addDaysIso(w, n) ?? w);
  const goToday = () => setWeekStart(weekStartOf(localTodayIso()) ?? localTodayIso());

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-full mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Schedule</h1>
      </div>
      <p className="text-xs text-muted mb-4">Who works when. Import a schedule or build shifts to fill this in.</p>

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
                      const cell = cellFor(emp.id, d);
                      return (
                        <td key={d} className={`text-center text-[11px] px-2 py-2 border-b border-white/5 whitespace-nowrap tabular-nums ${cell ? "text-primary" : "text-muted/40"}`}>
                          {cell || "·"}
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
