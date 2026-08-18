"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DoorOpen, BarChart3 } from "lucide-react";

/**
 * Macro Mode toggle (per-rep, alongside the normal Sales Coach — founder decision 2026-08-18). A rep flips
 * it on to reveal the Door Log + Report Card entries. Self-contained: reads/writes profiles.macro_mode_enabled
 * via /api/coach/sales-session/macro-mode.
 */
export function MacroModeToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/coach/sales-session/macro-mode")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = useCallback(async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next); // optimistic
    try {
      const res = await fetch("/api/coach/sales-session/macro-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(!next); // revert on failure
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }, [enabled, saving]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 mt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-brand" aria-hidden />
            <span className="text-sm font-semibold text-primary">Macro Mode</span>
          </div>
          <p className="text-[11px] text-muted mt-0.5">
            Door-to-door: fast Door Log + a macro Report Card. Feedback processes in the background.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={enabled === null || saving}
          role="switch"
          aria-checked={enabled ?? false}
          aria-label="Toggle Macro Mode"
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
            enabled ? "bg-ember-400" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Link
            href="/dashboard/sales-coach/doors"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-ember-400 text-[#09090B] text-sm font-semibold"
          >
            <DoorOpen className="w-4 h-4" aria-hidden /> Door Log
          </Link>
          <Link
            href="/dashboard/sales-coach/doors/report-card"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface border border-default text-primary text-sm font-semibold"
          >
            <BarChart3 className="w-4 h-4" aria-hidden /> Report Card
          </Link>
        </div>
      )}
    </div>
  );
}
