"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CalendarDays, Printer, User } from "lucide-react";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";
import { AvailabilityEditor } from "@/components/schedule/AvailabilityEditor";
import type { Employee, Availability } from "@/lib/schedule/types";
import type { PersonalSchedule } from "@/lib/schedule/personalSchedule";

/**
 * Schedule Management System — Phase 6, one employee's printable personal schedule (manager-entered
 * model, founder decision 2026-08-20: no employee login yet). A manager picks a staff member (or
 * arrives from the roster's "Schedule" link) and sees just that person's upcoming shifts + approved
 * time off, in a layout that prints clean. The picker + nav are print:hidden so a printout is the
 * schedule alone. Read-only — no events are appended here.
 */

type Data = { employee: { id: string; name: string; role: string | null }; schedule: PersonalSchedule; availability: Availability | null };

// Format an ISO date (YYYY-MM-DD) as a local weekday + date. Parse the parts explicitly rather than
// `new Date(iso)` — the latter reads the string as UTC midnight and can render the previous day in a
// negative-UTC timezone (the UTC-today-in-browser class).
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function PersonalInner() {
  const params = useSearchParams();
  const [employeeId, setEmployeeId] = useState(params.get("employeeId") ?? "");
  const [roster, setRoster] = useState<Employee[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/schedule/employees");
        if (r.ok) setRoster(((await r.json()).employees ?? []).filter((e: Employee) => e.status === "active"));
      } catch { /* picker stays empty; a passed employeeId still loads */ }
    })();
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) { setData(null); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/schedule/personal?employeeId=${encodeURIComponent(id)}`);
      if (r.ok) setData(await r.json());
      else {
        setData(null);
        setError(
          r.status === 404 ? "That staff member isn't on your roster."
          : r.status === 403 ? "Only a manager can view an employee's schedule."
          : "Couldn't load the schedule. Try again.",
        );
      }
    } catch { setData(null); setError("Couldn't reach the server."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(employeeId); }, [employeeId, load]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-3xl mx-auto w-full print:overflow-visible print:max-w-none">
      <div className="print:hidden">
        <ScheduleNav />
        <div className="flex items-center gap-2 mb-1">
          <User className="w-6 h-6 text-brand" aria-hidden />
          <h1 className="text-xl font-bold text-primary">Personal Schedule</h1>
        </div>
        <p className="text-xs text-muted mb-4">Pick a staff member to see and print just their shifts. No account needed.</p>

        <div className="flex items-center gap-2 mb-5">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
            <option value="">Select staff…</option>
            {roster.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {data && (
            <button type="button" onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black">
              <Printer className="w-3.5 h-3.5" aria-hidden /> Print
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-300 print:hidden">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center print:hidden">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      ) : !employeeId ? (
        <p className="text-sm text-muted print:hidden">Choose someone above.</p>
      ) : data ? (
        <>
        <div className="glass-card p-5 print:shadow-none print:border-0 print:p-0">
          {/* Header — the printout identifies whose schedule it is. */}
          <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3 mb-4 print:border-black/20">
            <div>
              <div className="text-lg font-bold text-primary">{data.employee.name}</div>
              <div className="text-xs text-muted">{data.employee.role ?? "no role set"}</div>
            </div>
            <div className="text-xs text-muted text-right">
              {data.schedule.upcoming.length} upcoming shift{data.schedule.upcoming.length === 1 ? "" : "s"}
              {data.schedule.totalHours > 0 && <> · {data.schedule.totalHours}h</>}
            </div>
          </div>

          {data.schedule.upcoming.length === 0 ? (
            <p className="text-sm text-muted">No upcoming shifts scheduled.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.schedule.upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-primary"><CalendarDays className="w-3.5 h-3.5 inline mr-1.5 text-brand print:text-black" aria-hidden />{fmtDate(s.date)}</span>
                  <span className="text-secondary tabular-nums">{s.start}&ndash;{s.end} <span className="text-muted">· {s.hours}h</span></span>
                </li>
              ))}
            </ul>
          )}

          {data.schedule.approvedTimeOff.length > 0 && (
            <div className="mt-5 pt-3 border-t border-white/10 print:border-black/20">
              <div className="text-xs font-semibold text-secondary mb-1.5">Approved time off</div>
              <ul className="space-y-1">
                {data.schedule.approvedTimeOff.map((t, i) => (
                  <li key={i} className="text-xs text-muted">
                    {t.type} · {fmtDate(t.start)}{t.end !== t.start ? ` to ${fmtDate(t.end)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* Manager-entered availability — print:hidden so it never lands on the printout. Keyed on the
            employee so switching staff re-mounts it with THEIR data (context-switch state-bleed guard). */}
        <div className="print:hidden">
          <AvailabilityEditor key={data.employee.id} employeeId={data.employee.id} initial={data.availability} onSaved={() => void load(employeeId)} />
        </div>
        </>
      ) : null}
    </div>
  );
}

export default function PersonalSchedulePage() {
  // useSearchParams requires a Suspense boundary in the app router.
  return <Suspense fallback={null}><PersonalInner /></Suspense>;
}
