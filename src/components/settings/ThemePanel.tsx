"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Palette, Loader2 } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";
import { useToast } from "@/components/ui/toast";
import { supabaseEnabled } from "@/lib/supabase/client";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Appearance panel — the per-user theme override (persisted cross-device via
 * /api/me/theme) plus, for admins, the company default theme new members inherit.
 *
 * The user segmented control drives ThemeProvider.setPreference, which applies
 * instantly, caches to localStorage (flash-free), and persists to the DB. The
 * company-default control is admin-only and company-scoped (founder 2026-07-28).
 */
export function ThemePanel() {
  const { preference, setPreference } = useTheme();
  const toast = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [companyDefault, setCompanyDefault] = useState<ThemePreference | null>(null);
  const [savingCompany, setSavingCompany] = useState<ThemePreference | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/theme");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setIsAdmin(Boolean(data?.isAdmin));
        if (data?.companyDefault === "system" || data?.companyDefault === "light" || data?.companyDefault === "dark") {
          setCompanyDefault(data.companyDefault);
        }
      } catch {
        /* offline — the user control still works via ThemeProvider */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCompanyDefault = async (value: ThemePreference) => {
    setSavingCompany(value);
    try {
      const res = await fetch("/api/me/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyDefault: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setCompanyDefault(value);
      toast.success("Company default theme saved");
    } catch (err) {
      toast.error("Not saved", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingCompany(null);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Palette className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-primary">Appearance</h2>
      </div>
      <p className="text-xs text-muted mb-5">
        Your theme applies on every device you sign in on. New team members start on the company
        default until they pick their own.
      </p>

      {/* Per-user override */}
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Your theme</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Your theme">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = preference === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setPreference(value)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  active
                    ? "border-ember-400/70 bg-ember-400/10 text-brand"
                    : "border-default text-secondary hover:border-ember-400/40 hover:text-primary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company default — admin only */}
      {isAdmin && (
        <div className="pt-4 border-t border-default">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-1">
            Company default
          </p>
          <p className="text-[11px] text-muted mb-2">
            Applied to team members who haven&apos;t chosen their own theme. Only you (admins) can
            change this.
          </p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Company default theme">
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = companyDefault === value;
              const busy = savingCompany === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  disabled={savingCompany !== null}
                  onClick={() => saveCompanyDefault(value)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 ${
                    active
                      ? "border-ember-400/70 bg-ember-400/10 text-brand"
                      : "border-default text-secondary hover:border-ember-400/40 hover:text-primary"
                  }`}
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Icon className="w-3.5 h-3.5" aria-hidden />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
