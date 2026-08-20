"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Printer, Download } from "lucide-react";
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
    () => buildWeekGrid(
      state ? Object.values(state.shifts) : [],
      dates,
      state ? Object.values(state.timeOff).filter((t) => t.status === "approved").map((t) => ({ employeeId: t.employeeId, start: t.start, end: t.end })) : [],
    ),
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

  // Render the visible week as a clean, WHITE, printable/shareable image on a canvas (no dependency). The dark
  // themed on-screen table doesn't print well, so print + download both use this one graphic — a plain
  // staff x date grid anyone can read at a glance.
  const renderCanvas = useCallback((): HTMLCanvasElement | null => {
    if (typeof document === "undefined") return null;
    const nameW = 190, colW = 116, rowH = 40, headH = 54, titleH = 52, pad = 24, scale = 2;
    const cols = dates.length;
    const w = pad * 2 + nameW + cols * colW;
    const h = pad * 2 + titleH + headH + rows.length * rowH;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    // Title
    ctx.fillStyle = "#111827"; ctx.font = "bold 22px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`Schedule — Week of ${weekStart}`, pad, pad + 30);
    const gTop = pad + titleH;
    const gW = nameW + cols * colW;
    // Header band
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(pad, gTop, gW, headH);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#374151"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Name", pad + 14, gTop + headH / 2);
    ctx.textAlign = "center";
    dates.forEach((d, i) => {
      const x = pad + nameW + i * colW + colW / 2;
      ctx.fillStyle = "#9ca3af"; ctx.font = "11px system-ui, sans-serif"; ctx.fillText(weekdayOf(d), x, gTop + 17);
      ctx.fillStyle = "#374151"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillText(dayLabel(d), x, gTop + 37);
    });
    // Rows
    rows.forEach((emp, r) => {
      const y = gTop + headH + r * rowH;
      if (r % 2 === 1) { ctx.fillStyle = "#f9fafb"; ctx.fillRect(pad, y, gW, rowH); }
      ctx.fillStyle = "#111827"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(emp.name, pad + 14, y + rowH / 2, nameW - 20);
      ctx.textAlign = "center";
      dates.forEach((d, i) => {
        const c = cell(emp.id, d);
        const x = pad + nameW + i * colW + colW / 2;
        if (c) {
          ctx.fillStyle = c.off ? "#b45309" : "#111827";
          ctx.font = c.off ? "italic 11px system-ui, sans-serif" : "12px system-ui, sans-serif";
          ctx.fillText(c.off ? `${c.label} (off)` : c.label, x, y + rowH / 2, colW - 8);
        } else { ctx.fillStyle = "#d1d5db"; ctx.font = "12px system-ui, sans-serif"; ctx.fillText("·", x, y + rowH / 2); }
      });
    });
    // Gridlines
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    for (let r = 0; r <= rows.length; r++) { const y = gTop + headH + r * rowH; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + gW, y); ctx.stroke(); }
    for (let c = 0; c <= cols; c++) { const x = pad + nameW + c * colW; ctx.beginPath(); ctx.moveTo(x, gTop); ctx.lineTo(x, gTop + headH + rows.length * rowH); ctx.stroke(); }
    ctx.strokeStyle = "#d1d5db"; ctx.strokeRect(pad, gTop, gW, headH + rows.length * rowH);
    return canvas;
  }, [dates, rows, cell, weekStart]);

  const [printImg, setPrintImg] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clear = () => setPrintImg(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  // Download the week as a PNG image (a real, shareable graphic).
  const downloadPng = () => {
    const canvas = renderCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `schedule-${weekStart}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // Print: swap in the white canvas image (print:block) and open the browser print dialog — clean, no popup,
  // no fighting the dark theme. afterprint clears it.
  const printSchedule = () => {
    const canvas = renderCanvas();
    if (!canvas) return;
    setPrintImg(canvas.toDataURL("image/png"));
    setTimeout(() => window.print(), 150);
  };

  return (
    <>
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-full mx-auto w-full print:hidden">
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
        {/* Print + Download the week as a clean, white, shareable visual (both use the same canvas render). */}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={printSchedule} disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-40">
            <Printer className="w-3.5 h-3.5" aria-hidden /> Print
          </button>
          <button type="button" onClick={downloadPng} disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
            <Download className="w-3.5 h-3.5" aria-hidden /> Download
          </button>
        </div>
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
                              title={c.off ? `${emp.name} has APPROVED time off on this day — they won't work this shift. Click to unassign.` : `Unassign ${emp.name} from this shift`}
                              className={`rounded px-1.5 py-0.5 hover:bg-white/10 disabled:opacity-50 transition-colors ${c.off ? "text-amber-300 line-through decoration-amber-300/70" : ""}`}
                            >
                              {busy ? "…" : c.off ? `${c.label} (off)` : c.label}
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
    {/* Print-only: the clean white schedule image (everything else is print:hidden). */}
    <div className="hidden print:block">
      {/* A canvas data-URL for printing — next/image can't optimize a runtime data URL, and it's print-only. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {printImg && <img src={printImg} alt={`Schedule week of ${weekStart}`} className="w-full" />}
    </div>
    </>
  );
}
