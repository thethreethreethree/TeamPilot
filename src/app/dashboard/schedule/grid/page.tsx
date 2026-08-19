"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CalendarDays } from "lucide-react";
import type { Employee, ScheduleState } from "@/lib/schedule/types";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — the grid schedule view (Phase 5, the founder's chosen primary layout).
 * Staff down the side, dates across the top, each cell the shift that person works that day (like the
 * HUB SCHED / frendz samples). Reads the derived state (events -> projector) + the roster. Read-only for
 * now (building/publishing shifts by hand is a sibling surface); honest loading/error.
 */

type EventsResponse = { state: ScheduleState };

export default function ScheduleGridPage() {
  const [state, setState] = useState<ScheduleState | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ev, emp] = await Promise.all([
        fetch("/api/schedule/events"),
        fetch("/api/schedule/employees"),
      ]);
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

  // Pivot the derived shifts into a staff x date grid.
  const { dates, cellFor } = useMemo(() => {
    const shifts = state ? Object.values(state.shifts) : [];
    const dateSet = new Set<string>();
    for (const s of shifts) dateSet.add(s.date);
    const dates = [...dateSet].sort();
    // employeeId -> date -> "HH:mm-HH:mm"
    const byEmpDate = new Map<string, Map<string, string>>();
    for (const s of shifts) {
      for (const empId of s.assigned) {
        if (!byEmpDate.has(empId)) byEmpDate.set(empId, new Map());
        byEmpDate.get(empId)!.set(s.date, `${s.start}-${s.end}`);
      }
    }
    const cellFor = (empId: string, date: string) => byEmpDate.get(empId)?.get(date) ?? "";
    return { dates, cellFor };
  }, [state]);

  const dayLabel = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${m}/${d}`;
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-full mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Schedule</h1>
      </div>
      <p className="text-xs text-muted mb-5">Who works when. Import a schedule or build shifts to fill this in.</p>

      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">Couldn&apos;t load the schedule. This is an error, not an empty schedule. Try again.</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-brand hover:underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading schedule…
        </div>
      ) : dates.length === 0 || roster.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing scheduled yet. Add staff to the roster and import or build a schedule to see the grid here.
        </p>
      ) : (
        <div className="overflow-x-auto glass-card p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-surface text-left text-xs font-semibold text-secondary px-3 py-2 border-b border-white/10 min-w-[9rem]">Name</th>
                {dates.map((d) => (
                  <th key={d} className="text-center text-[11px] font-semibold text-secondary px-2 py-2 border-b border-white/10 whitespace-nowrap tabular-nums">
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((emp) => (
                <tr key={emp.id}>
                  <td className="sticky left-0 bg-base text-primary text-xs px-3 py-2 border-b border-white/5 truncate min-w-[9rem]">
                    {emp.name}
                  </td>
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
      )}
    </div>
  );
}
