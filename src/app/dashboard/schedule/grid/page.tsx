"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Printer, Download } from "lucide-react";
import type { Employee, ScheduleState } from "@/lib/schedule/types";
import { weekStartOf, addDaysIso } from "@/lib/schedule/constraints";
import { todayInTz, DEFAULT_SCHEDULE_SETTINGS, type ScheduleSettings } from "@/lib/schedule/settings";
import { buildWeekGrid, relevantRows, weeksWithShifts } from "@/lib/schedule/gridView";
import { scheduleInsights, understaffedWeekdays } from "@/lib/schedule/insights";
import { bandFromLabel, BAND_STYLE, WORKED_BANDS } from "@/lib/schedule/shiftColors";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";
import { useCompanyName } from "@/lib/hooks/useCompany";

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
  const companyName = useCompanyName(); // for the printed/downloaded schedule header
  const [state, setState] = useState<ScheduleState | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [weekStart, setWeekStart] = useState<string>(() => weekStartOf(localTodayIso()) ?? localTodayIso());
  const [coverageGaps, setCoverageGaps] = useState<{ date: string }[]>([]); // for the understaffed-weekday pattern
  const initialWeekSet = useRef(false); // set the default week from settings ONCE (a reload must not jump off a navigated week)

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [ev, emp, set, cov] = await Promise.all([
        fetch("/api/schedule/events"),
        fetch("/api/schedule/employees"),
        fetch("/api/schedule/settings"), // non-critical: falls back to defaults below
        fetch("/api/schedule/coverage").catch(() => null), // non-critical: powers the understaffed-day pattern
      ]);
      if (!ev.ok || !emp.ok) { setError(true); return; }
      const evd: EventsResponse = await ev.json();
      const empd: { employees: Employee[] } = await emp.json();
      setState(evd.state);
      setRoster(empd.employees ?? []);
      try { if (cov?.ok) setCoverageGaps(((await cov.json()).gaps ?? []).map((g: { date: string }) => ({ date: g.date }))); } catch { /* pattern just omits */ }
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

  // Phase 7 (§3.6): current patterns a manager might miss — over-reliance by hours + unused staff. Honest
  // "current patterns" (deterministic), not overclaimed longitudinal learning.
  const insights = useMemo(
    () => (state ? scheduleInsights(Object.values(state.shifts), roster, todayInTz(settings.timezone)) : null),
    [state, roster, settings.timezone],
  );
  const gapWeekdays = useMemo(() => understaffedWeekdays(coverageGaps.map((g) => g.date)), [coverageGaps]);

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

  // The grid data for ANY week (dates + a cell lookup + the relevant rows) — reuses the tested pure helpers so
  // the exported image matches the on-screen grid exactly. Used to export every week with shifts.
  const weekGridData = useCallback((ws: string) => {
    const dts = [0, 1, 2, 3, 4, 5, 6].map((n) => addDaysIso(ws, n)).filter((d): d is string => d !== null);
    const off = state ? Object.values(state.timeOff).filter((t) => t.status === "approved").map((t) => ({ employeeId: t.employeeId, start: t.start, end: t.end })) : [];
    const g = buildWeekGrid(state ? Object.values(state.shifts) : [], dts, off);
    return { dts, cellFn: g.cell, rws: relevantRows(roster, g.scheduledIds) };
  }, [state, roster]);

  // Render one or ALL weeks to a designed, COLOUR-CODED schedule graphic (no dependency). Shifts are tinted by
  // time of day (morning/day/evening/overnight) with a legend, so a manager reads "who works nights vs mornings"
  // at a glance — the founder's explicit ask (§1.5.4: the colour-coding IS the deliverable, not polish). Print +
  // download share this. mode "all" stacks every week that has shifts into one tall image.
  const renderCanvas = useCallback((mode: "week" | "all"): HTMLCanvasElement | null => {
    if (typeof document === "undefined") return null;
    const nameW = 196, colW = 120, rowH = 42, headH = 50, titleH = 46, pad = 26, gap = 30, scale = 2;
    const bandH = 68, legendH = 40; // brand header band + colour legend

    // Which weeks to draw: the visible one, or every distinct week that has at least one relevant row.
    const weekList = mode === "all" && state
      ? weeksWithShifts(Object.values(state.shifts), settings.workweekStart)
      : [weekStart];
    const blocks = weekList.map((ws) => ({ ws, ...weekGridData(ws) })).filter((b) => b.rws.length > 0);
    if (blocks.length === 0) return null;
    const title = (settings.scheduleName?.trim() || companyName || "Schedule");
    const anyOff = blocks.some((b) => b.rws.some((e) => b.dts.some((d) => b.cellFn(e.id, d)?.off)));

    const gW = nameW + 7 * colW;
    const w = pad * 2 + gW;
    const footerH = 26;
    const blockH = (n: number) => titleH + headH + n * rowH;
    const h = pad + bandH + legendH + 14 + footerH + blocks.reduce((sum, b) => sum + blockH(b.rws.length) + gap, -gap) + pad;

    // A browser canvas maxes out near 32767px per side; a huge multi-week schedule would silently render blank.
    // Guard it: fail LOUD (return null → the caller shows a message) rather than export a broken image.
    if (h * scale > 30000) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    // Rounded-rect helper (roundRect is widely supported; fall back to a plain rect on old engines).
    const rrect = (x: number, y: number, wd: number, ht: number, rad: number) => {
      ctx.beginPath();
      if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function") ctx.roundRect(x, y, wd, ht, rad);
      else ctx.rect(x, y, wd, ht);
    };
    const isWeekend = (d: string) => { const wd = weekdayOf(d); return wd === "Sat" || wd === "Sun"; };

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);

    // ---- Brand header band: eyebrow + title, generated date on the right ----
    ctx.fillStyle = "#0f172a"; rrect(pad, pad, gW, bandH, 14); ctx.fill();
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = "#7dd3fc"; ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("W O R K   S C H E D U L E", pad + 22, pad + 26);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 27px system-ui, sans-serif";
    ctx.fillText(title, pad + 22, pad + 54, gW - 260);
    ctx.textAlign = "right"; ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, pad + gW - 22, pad + 34);
    const firstWs = blocks[0]!.ws, lastWs = blocks[blocks.length - 1]!.ws;
    const span = blocks.length > 1 ? `${firstWs} → ${lastWs}` : `Week of ${firstWs}`;
    ctx.fillText(span, pad + gW - 22, pad + 52);

    // ---- Legend: a colour chip per time-of-day band (+ time off when present) ----
    const legendY = pad + bandH + legendH / 2 + 4;
    const chips = [...WORKED_BANDS, ...(anyOff ? (["off"] as const) : [])];
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    let lx = pad + 22;
    ctx.font = "bold 12px system-ui, sans-serif";
    for (const band of chips) {
      const st = BAND_STYLE[band];
      rrect(lx, legendY - 7, 14, 14, 4); ctx.fillStyle = st.bg; ctx.fill();
      ctx.strokeStyle = st.dot; ctx.lineWidth = 1.5; rrect(lx, legendY - 7, 14, 14, 4); ctx.stroke();
      ctx.fillStyle = "#475569"; ctx.fillText(st.label, lx + 20, legendY);
      lx += 26 + ctx.measureText(st.label).width + 22;
    }

    let yTop = pad + bandH + legendH + 14;
    for (const b of blocks) {
      const { ws, dts, cellFn, rws } = b;
      // Week title with a brand accent bar.
      ctx.fillStyle = "#6366f1"; rrect(pad, yTop + 8, 5, 22, 2.5); ctx.fill();
      ctx.fillStyle = "#0f172a"; ctx.font = "bold 19px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(`Week of ${ws}`, pad + 16, yTop + 26);
      const gTop = yTop + titleH;
      const gBottom = gTop + headH + rws.length * rowH;

      // Weekend column tint (behind everything), so Sat/Sun read as different from the workweek.
      dts.forEach((d, i) => {
        if (!isWeekend(d)) return;
        ctx.fillStyle = "#fff7ed"; ctx.fillRect(pad + nameW + i * colW, gTop, colW, gBottom - gTop);
      });
      // Header row.
      ctx.fillStyle = "#f1f5f9"; rrect(pad, gTop, gW, headH, 10); ctx.fill();
      ctx.textBaseline = "middle"; ctx.fillStyle = "#334155"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("Name", pad + 16, gTop + headH / 2);
      ctx.textAlign = "center";
      dts.forEach((d, i) => {
        const x = pad + nameW + i * colW + colW / 2;
        ctx.fillStyle = isWeekend(d) ? "#c2410c" : "#94a3b8"; ctx.font = "11px system-ui, sans-serif"; ctx.fillText(weekdayOf(d), x, gTop + 16);
        ctx.fillStyle = "#334155"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillText(dayLabel(d), x, gTop + 34);
      });
      // Rows.
      rws.forEach((emp, r) => {
        const y = gTop + headH + r * rowH;
        if (r % 2 === 1) { ctx.fillStyle = "#f8fafc"; ctx.fillRect(pad, y, nameW, rowH); }
        ctx.fillStyle = "#0f172a"; ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(emp.name, pad + 16, y + rowH / 2, nameW - 24);
        dts.forEach((d, i) => {
          const c = cellFn(emp.id, d);
          const cx = pad + nameW + i * colW;
          const x = cx + colW / 2;
          if (c) {
            const st = c.off ? BAND_STYLE.off : BAND_STYLE[bandFromLabel(c.label) ?? "day"];
            const pw = colW - 16, ph = 26;
            rrect(cx + 8, y + (rowH - ph) / 2, pw, ph, 8); ctx.fillStyle = st.bg; ctx.fill();
            ctx.fillStyle = st.fg; ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "center";
            ctx.fillText(c.off ? `${c.label} · off` : c.label, x, y + rowH / 2, pw - 8);
          } else {
            ctx.fillStyle = "#cbd5e1"; ctx.font = "13px system-ui, sans-serif"; ctx.textAlign = "center";
            ctx.fillText("·", x, y + rowH / 2);
          }
        });
      });
      // Light column separators + an outer frame.
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
      for (let c = 1; c < 7; c++) { const x = pad + nameW + c * colW; ctx.beginPath(); ctx.moveTo(x, gTop + headH); ctx.lineTo(x, gBottom); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(pad + nameW, gTop); ctx.lineTo(pad + nameW, gBottom); ctx.stroke();
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.25; rrect(pad, gTop, gW, gBottom - gTop, 10); ctx.stroke();
      yTop += blockH(rws.length) + gap;
    }
    // Footer: when this was generated (so a printed copy's currency is clear).
    ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`Generated ${new Date().toLocaleString()}`, pad, h - pad + 6);
    return canvas;
  }, [state, settings.workweekStart, settings.scheduleName, weekStart, weekGridData, companyName]);

  const [printImg, setPrintImg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const tooLargeMsg = "This schedule is too large to export as one image. Export week by week (This week / Print), or tell me and I'll add a multi-page PDF.";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clear = () => setPrintImg(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);
  // Print only AFTER the print image has actually painted (two rAFs), not on a fixed timeout that could fire
  // before the image is on screen and print a blank page.
  useEffect(() => {
    if (!printImg || typeof window === "undefined") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => cancelAnimationFrame(id);
  }, [printImg]);

  // Download as a PNG image (a real, shareable graphic). mode "all" = the whole schedule (every week with
  // shifts) in one file; "week" = just the visible week.
  const downloadPng = (mode: "week" | "all") => {
    const canvas = renderCanvas(mode);
    if (!canvas) { if (mode === "all") setExportMsg(tooLargeMsg); return; }
    setExportMsg(null);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = mode === "all" ? "schedule-all-weeks.png" : `schedule-${weekStart}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // Print: swap in the white canvas image (print:block) and open the browser print dialog — clean, no popup,
  // no fighting the dark theme. afterprint clears it. mode "all" prints the whole schedule across pages.
  const printSchedule = (mode: "week" | "all") => {
    const canvas = renderCanvas(mode);
    if (!canvas) { if (mode === "all") setExportMsg(tooLargeMsg); return; }
    setExportMsg(null);
    setPrintImg(canvas.toDataURL("image/png")); // the effect above prints once it has painted
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
        {/* Print + Download a clean, white, shareable visual. "This week" = the shown week; "All weeks" = the
            whole schedule (every week with shifts) in one file/printout. Both use the same canvas render. */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => printSchedule("week")} disabled={rows.length === 0}
            title="Print the shown week"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-40">
            <Printer className="w-3.5 h-3.5" aria-hidden /> Print
          </button>
          <button type="button" onClick={() => downloadPng("week")} disabled={rows.length === 0}
            title="Download the shown week as an image"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-40">
            <Download className="w-3.5 h-3.5" aria-hidden /> This week
          </button>
          <button type="button" onClick={() => downloadPng("all")} disabled={!state || Object.keys(state.shifts).length === 0}
            title="Download the WHOLE schedule (all weeks with shifts) as one image"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
            <Download className="w-3.5 h-3.5" aria-hidden /> Download all
          </button>
          <button type="button" onClick={() => printSchedule("all")} disabled={!state || Object.keys(state.shifts).length === 0}
            title="Print the WHOLE schedule (all weeks with shifts)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-secondary hover:text-primary disabled:opacity-40">
            <Printer className="w-3.5 h-3.5" aria-hidden /> Print all
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          <span className="text-xs text-amber-300">{exportMsg}</span>
          <button type="button" onClick={() => setExportMsg(null)} className="text-xs font-semibold text-amber-300 hover:underline">Dismiss</button>
        </div>
      )}

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

          {/* Phase 7 (§3.6): current patterns — over-reliance by hours + unused staff. Honest "current
              patterns", computed deterministically; not overclaimed longitudinal learning. */}
          {insights && insights.totalUpcomingShifts > 0 && (
            <div className="glass-card p-4 mt-4">
              <div className="text-sm font-semibold text-secondary mb-2">Patterns in your schedule</div>
              {insights.overReliance && (
                <p className="flex items-start gap-1.5 text-xs text-amber-300 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                  <span><span className="font-semibold">{insights.overReliance.name}</span> is carrying the most hours ({insights.overReliance.hours}h upcoming) — well above the team average. Consider spreading the load.</span>
                </p>
              )}
              <div className="text-[11px] text-muted mb-1">Upcoming hours per person (most first):</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {insights.hoursByStaff.slice(0, 12).map((s) => (
                  <span key={s.employeeId} className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-white/10 text-secondary tabular-nums">{s.name} · {s.hours}h</span>
                ))}
              </div>
              {insights.unusedStaff.length > 0 && (
                <p className="text-[11px] text-muted">Active but not scheduled: {insights.unusedStaff.join(", ")}.</p>
              )}
              {gapWeekdays.length > 0 && (
                <p className="text-[11px] text-amber-300/90 mt-1">Most often short: {gapWeekdays.slice(0, 3).map((g) => `${g.weekday} (${g.count})`).join(", ")}.</p>
              )}
            </div>
          )}
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
