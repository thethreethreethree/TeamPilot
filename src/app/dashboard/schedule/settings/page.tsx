"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Settings as SettingsIcon, Check, Trash2, AlertTriangle } from "lucide-react";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";
import { DEFAULT_SCHEDULE_SETTINGS, type ScheduleSettings } from "@/lib/schedule/settings";

/**
 * Schedule Management System — company schedule settings (RQ4 / RQ7): timezone + workweek-start.
 * These drive what "today" is (the current/upcoming filters, the grid's default week) and where the
 * workweek/payroll week begins (the weekly-hours cap + the grid columns). Manager-only (enforced by the
 * schedule layout gate + the PATCH route).
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export default function ScheduleSettingsPage() {
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SCHEDULE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  // Clear-the-schedule (danger zone): a two-step confirm so it can't be a one-click accident.
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearingRef = useRef(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  const clearSchedule = async () => {
    if (clearingRef.current) return;
    clearingRef.current = true;
    setClearing(true);
    setClearMsg(null);
    try {
      const res = await fetch("/api/schedule/clear", { method: "POST" });
      if (res.ok) {
        const { cleared } = await res.json();
        setClearMsg(cleared > 0 ? `Cleared ${cleared} shift${cleared === 1 ? "" : "s"}. The schedule is now empty; your staff are unchanged.` : "The schedule was already empty.");
        setConfirmClear(false);
      } else {
        setClearMsg(res.status === 403 ? "Only a manager can clear the schedule." : "Couldn't clear the schedule. Nothing was changed.");
      }
    } catch {
      setClearMsg("Couldn't reach the server.");
    } finally {
      clearingRef.current = false;
      setClearing(false);
    }
  };

  // The IANA zones the runtime knows — no dependency; a plain, complete, sorted picker.
  const zones = useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
      return list && list.length > 0 ? list : ["UTC"];
    } catch {
      return ["UTC"];
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule/settings");
      if (!res.ok) { setError("Couldn't load settings."); return; }
      setSettings(await res.json());
    } catch {
      setError("Couldn't load settings.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/schedule/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) { setError("Couldn't save settings. Try again."); return; }
      setSettings(await res.json());
      setSaved(true);
    } catch {
      setError("Couldn't save settings. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 max-w-full mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <SettingsIcon className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Schedule settings</h1>
      </div>
      <p className="text-xs text-muted mb-4">Timezone and the day your workweek starts. These set what &ldquo;today&rdquo; means and where the week begins for hours and the grid.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading settings…
        </div>
      ) : (
        <div className="glass-card p-4 space-y-4 max-w-md">
          <div>
            <label htmlFor="schedName" className="block text-sm font-semibold text-secondary mb-1">Schedule name</label>
            <input id="schedName" type="text" maxLength={60} value={settings.scheduleName ?? ""}
              placeholder="Your company name"
              onChange={(e) => { setSettings((s) => ({ ...s, scheduleName: e.target.value })); setSaved(false); }}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
            <p className="text-[11px] text-muted mt-1">Shown as the title on printed &amp; downloaded schedules. Leave blank to use your company name.</p>
          </div>
          <div>
            <label htmlFor="tz" className="block text-sm font-semibold text-secondary mb-1">Timezone</label>
            <select id="tz" value={settings.timezone} onChange={(e) => { setSettings((s) => ({ ...s, timezone: e.target.value })); setSaved(false); }}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="wk" className="block text-sm font-semibold text-secondary mb-1">Workweek starts on</label>
            <select id="wk" value={settings.workweekStart} onChange={(e) => { setSettings((s) => ({ ...s, workweekStart: Number(e.target.value) })); setSaved(false); }}
              className="w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary">
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
              Save settings
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved.</span>}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}

      {/* Danger zone — clear the whole schedule (append-only: cancels every shift; staff untouched). */}
      {!loading && (
        <div className="glass-card p-4 space-y-3 max-w-md mt-6 border border-red-500/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle className="w-4 h-4" aria-hidden /> Danger zone
          </div>
          <p className="text-xs text-muted">
            Clear the schedule to remove every shift and start fresh (useful after a test import). Your <span className="text-secondary">staff and coverage rules are kept</span> — only the shifts are removed.
          </p>
          {!confirmClear ? (
            <button type="button" onClick={() => { setConfirmClear(true); setClearMsg(null); }}
              className="inline-flex items-center gap-2 rounded-lg bg-surface border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear the schedule
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearSchedule} disabled={clearing}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Trash2 className="w-3.5 h-3.5" aria-hidden />}
                Yes, remove every shift
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing}
                className="rounded-lg bg-surface border border-white/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">Cancel</button>
            </div>
          )}
          {clearMsg && <p className="text-xs text-secondary">{clearMsg}</p>}
        </div>
      )}
    </div>
  );
}
