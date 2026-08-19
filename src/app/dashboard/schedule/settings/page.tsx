"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Settings as SettingsIcon, Check } from "lucide-react";
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
    </div>
  );
}
