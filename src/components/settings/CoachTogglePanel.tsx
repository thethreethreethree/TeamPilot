"use client";

import { useEffect, useState } from "react";
import { BookOpen, BookOpenCheck, Loader2 } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/**
 * CoachTogglePanel — admin-only company-level switch for the
 * Conversational Coach.
 *
 * Behavior:
 *   - Reads `companies.coach_enabled` on mount.
 *   - Toggle PATCHes the row and emits a coach.{enabled,disabled}
 *     event on the §3.1 chain (subject = company:<id>) so the
 *     readout can attribute outcomes to "Coach was active during
 *     this window."
 *   - Per asset A3 — default OFF. Even with this toggle, a clean
 *     OFF→ON flip is the §4 readout's before/after baseline.
 *
 * Surfaces it affects (when ON): Tasks · Decision Dialogue (when the
 * Coach mount lands there) · Feedback drafts · Smoke test notes · all
 * Chat topics regardless of per-topic flag. Per-topic chat
 * `coach_enabled` stays as the finer-grained override when the
 * company-level switch is OFF.
 */
export function CoachTogglePanel() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (!profile?.company_id) return;
        if (cancelled) return;
        setCompanyId(profile.company_id);
        const { data: company } = await supabase
          .from("companies")
          .select("coach_enabled")
          .eq("id", profile.company_id)
          .maybeSingle();
        if (!cancelled && company) {
          setEnabled(Boolean(company.coach_enabled));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flip = async () => {
    if (!companyId || enabled == null || saving) return;
    const next = !enabled;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("companies")
      .update({ coach_enabled: next })
      .eq("id", companyId);
    if (error) {
      toast.error("Couldn't update Coach setting", error.message);
      setSaving(false);
      return;
    }
    setEnabled(next);
    // Audit event so the §4 readout can attribute later outcomes to
    // "Coach was active during this window." Non-fatal on failure.
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase.from("events").insert({
        company_id: companyId,
        actor: auth.user.id,
        kind: next ? "coach.enabled" : "coach.disabled",
        subject: `company:${companyId}`,
        payload: { enabled: next, scope: "company" },
      });
    })();
    toast.success(
      next ? "Conversational Coach: company-wide on" : "Conversational Coach: company-wide off",
      next
        ? "Surfaces in tasks, feedback, smoke-test notes, chat — heuristic citations as drafts are composed."
        : "Coach only on chat topics with their per-topic flag set."
    );
    setSaving(false);
  };

  if (!supabaseEnabled) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start gap-3 mb-3">
        {enabled ? (
          <BookOpenCheck className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden />
        ) : (
          <BookOpen className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" aria-hidden />
        )}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-primary mb-1">
            Conversational Coach
          </h2>
          <p className="text-[11px] text-muted leading-relaxed">
            Surfaces heuristic citations as your team drafts messages,
            task descriptions, feedback, and notes. Cites the
            constitutional principle and lets the author choose to
            refine — never auto-rewrites (§3.3). Every offered /
            accepted / dismissed lands on the §3.1 chain; outcomes
            visible on the Coach readout.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-default">
        <div className="text-xs">
          {loading ? (
            <span className="text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              Loading…
            </span>
          ) : enabled ? (
            <span className="text-brand font-semibold">
              On — company-wide
            </span>
          ) : (
            <span className="text-muted">
              Off — per-topic chat opt-in only
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={flip}
          disabled={loading || saving || enabled == null}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
            enabled
              ? "border-[#FACC15]/40 hover:border-[#FACC15]/70 text-brand bg-[#FACC15]/5"
              : "border-default hover:border-strong text-secondary"
          } disabled:opacity-40`}
        >
          {saving ? "Saving…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
