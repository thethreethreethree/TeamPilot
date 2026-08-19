"use client";

import { useState } from "react";
import { Loader2, CalendarX2, Check, Plus, X } from "lucide-react";
import type { Availability } from "@/lib/schedule/types";

/**
 * Schedule Management System — Phase 6, manager-entered availability editor. The manager sets, for one
 * employee, the weekly windows they CAN work + specific dates they are off. Saving appends an
 * AVAILABILITY_SET event (manager-gated events route); the authority then treats an assignment outside
 * this as an OVERRIDABLE "unavailable" violation and auto-suggest excludes them (founder 2026-08-20).
 *
 * Opt-in semantics (matches isAvailable): leaving ALL weekly days unchecked = available any day (only the
 * specific "days off" constrain them). Checking some days = those are the ONLY days/times they can work.
 * One window per day here (multi-window is a rare case not surfaced in v1) — noted so it isn't mistaken
 * for a dropped feature.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type DayRow = { on: boolean; from: string; to: string };

function initialRows(a: Availability | null): DayRow[] {
  return DAYS.map((_, dow) => {
    const w = a?.weekly.find((x) => x.dayOfWeek === dow);
    return w ? { on: true, from: w.from, to: w.to } : { on: false, from: "09:00", to: "17:00" };
  });
}

export function AvailabilityEditor({ employeeId, initial, onSaved }: {
  employeeId: string;
  initial: Availability | null;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<DayRow[]>(() => initialRows(initial));
  const [dates, setDates] = useState<string[]>(initial?.unavailableDates ?? []);
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<DayRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || dates.includes(newDate)) return;
    setDates((d) => [...d, newDate].sort());
    setNewDate("");
  };
  const removeDate = (d: string) => setDates((ds) => ds.filter((x) => x !== d));

  const save = async () => {
    if (saving) return;
    // Guard: a checked day must have from < to (a zero/negative window would silently never match).
    const bad = rows.some((r) => r.on && r.from >= r.to);
    if (bad) { setError("Each available day needs a start time before its end time."); return; }
    setSaving(true);
    setSaved(false);
    setError(null);
    const weekly = rows.flatMap((r, dow) => (r.on ? [{ dayOfWeek: dow, from: r.from, to: r.to }] : []));
    try {
      const res = await fetch("/api/schedule/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "AVAILABILITY_SET", payload: { employeeId, weekly, unavailableDates: dates } }),
      });
      if (res.ok) { setSaved(true); onSaved?.(); }
      else setError(res.status === 403 ? "Only a manager can set availability." : "Couldn't save. Try again.");
    } catch { setError("Couldn't reach the server."); }
    finally { setSaving(false); }
  };

  const noWeekly = rows.every((r) => !r.on);

  return (
    <div className="glass-card p-4 mt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-secondary mb-1">
        <CalendarX2 className="w-4 h-4" aria-hidden /> Availability
      </div>
      <p className="text-[11px] text-muted mb-3">
        Days and times this person can work. {noWeekly ? "All days unchecked = available any day (set specific days off below)." : "Only the checked days count as available."}
      </p>

      <div className="space-y-1.5 mb-4">
        {rows.map((r, i) => (
          <div key={DAYS[i]} className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 w-20 shrink-0 text-secondary cursor-pointer">
              <input type="checkbox" checked={r.on} onChange={(e) => setRow(i, { on: e.target.checked })} className="accent-brand" />
              {DAYS[i]}
            </label>
            <input type="time" value={r.from} disabled={!r.on} onChange={(e) => setRow(i, { from: e.target.value })}
              className="rounded bg-surface border border-white/10 px-2 py-1 text-primary disabled:opacity-40" />
            <span className="text-muted">to</span>
            <input type="time" value={r.to} disabled={!r.on} onChange={(e) => setRow(i, { to: e.target.value })}
              className="rounded bg-surface border border-white/10 px-2 py-1 text-primary disabled:opacity-40" />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-semibold text-secondary mb-1.5">Specific days off</div>
        <div className="flex items-center gap-2 mb-2">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg bg-surface border border-white/10 px-3 py-1.5 text-xs text-primary" />
          <button type="button" onClick={addDate} disabled={!newDate}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-white/10 text-secondary disabled:opacity-40">
            <Plus className="w-3 h-3" aria-hidden /> Add
          </button>
        </div>
        {dates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-surface border border-white/10 text-secondary">
                {d}
                <button type="button" onClick={() => removeDate(d)} aria-label={`Remove ${d}`} className="text-muted hover:text-primary"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No specific days off set.</p>
        )}
      </div>

      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
          Save availability
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
      </div>
    </div>
  );
}
