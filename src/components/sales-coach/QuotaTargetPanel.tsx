"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * Manager-set monthly deals-won target (KPI Quota Attainment source). Company-wide; a manager sets it here,
 * and each rep's Quota Attainment = their deals won this month ÷ this target. Until it's set, the metric
 * honestly reads "building". A34-aware: shows a note if migration 0206 is pending.
 */
export function QuotaTargetPanel() {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/quota");
      if (res.ok) {
        const d = await res.json();
        setSaved(d.target ?? null);
        setValue(d.target != null ? String(d.target) : "");
        setDegraded(!!d.degraded);
      }
    } catch {
      /* offline — the save will surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const trimmed = value.trim();
    const target = trimmed === "" ? null : Number(trimmed);
    if (target !== null && (!Number.isInteger(target) || target <= 0)) {
      toast.error("Enter a whole number of deals (1 or more), or leave blank to clear.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/coach/sales-session/quota", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error("Couldn't save", d?.error ?? undefined);
        return;
      }
      setSaved(target);
      toast.success(
        target === null ? "Quota target cleared" : "Quota target saved",
        target === null ? "Quota attainment will read 'building' until a target is set." : "Each rep's Quota Attainment now measures against this."
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = (value.trim() === "" ? null : Number(value.trim())) !== saved;

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Monthly quota (deals per rep)</h2>
      </div>
      <p className="text-xs text-secondary leading-relaxed">
        How many deals should each rep close per month? This drives the <b>Quota Attainment</b> KPI (deals won
        this month ÷ this target). Leave blank and the metric stays &quot;building&quot; — no fabricated goal.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <div className="max-w-[10rem]">
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Deals / month
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 10"
                className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
              />
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
              Save
            </button>
          </div>
          {degraded && (
            <p className="text-[11px] text-yellow-700 dark:text-yellow-300">
              Saving needs a pending database update (migration 0206). Until it&apos;s applied, Quota Attainment
              stays &quot;building&quot;.
            </p>
          )}
        </>
      )}
    </section>
  );
}
