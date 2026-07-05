"use client";

import { useEffect, useState } from "react";
import { BookOpen, BookOpenCheck, Loader2, Hourglass, ShieldAlert } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { LearningHint } from "@/components/learning/LearningHint";
import {
  resolveCyclePhase,
  canEnableCoach,
  phaseLabel,
  type CyclePhaseDetails,
} from "@/lib/cycle/phase";

/**
 * CoachTogglePanel — admin-only company-level switch for the
 * Conversational Coach, gated by the §3.4 month-cycle.
 *
 * §3.4 cycle (enforced by migration 0031 trigger):
 *   - Month 1 (control): Coach LOCKED OFF. Captures an honest
 *     baseline of the team operating as themselves.
 *   - Month 2 (intervention): Coach can be flipped on. Single-
 *     variable intervention — Coach is the only thing that changed.
 *   - Ongoing: Coach available, measurement continues.
 *
 * The DB trigger enforces the lock; this panel mirrors it in the
 * UI so the toggle is disabled with a clear reason instead of
 * round-tripping and surfacing a generic "update failed" error.
 *
 * Override path: an admin can record an explicit "skip control"
 * which jumps phase to intervention. The skip leaves a permanent
 * on-record mark (cycle_control_skipped_at + by + reason) and emits
 * a coach.control_skipped event so the §4 readout can flag the
 * company as "skipped control."
 */
export function CoachTogglePanel() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<CyclePhaseDetails | null>(null);
  const [showSkipForm, setShowSkipForm] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipSaving, setSkipSaving] = useState(false);

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
          .select(
            "coach_enabled, cycle_started_at, cycle_control_skipped_at"
          )
          .eq("id", profile.company_id)
          .maybeSingle();
        if (!cancelled && company) {
          setEnabled(Boolean(company.coach_enabled));
          if (company.cycle_started_at) {
            setCycle(
              resolveCyclePhase({
                cycleStartedAt: company.cycle_started_at,
                cycleControlSkippedAt: company.cycle_control_skipped_at,
              })
            );
          }
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
    // Mirror the DB trigger client-side so we don't even try the
    // round trip during control. The DB is authoritative — this is
    // a UX optimization, not the security boundary.
    if (next && cycle && !canEnableCoach(cycle)) {
      toast.warn(
        "§3.4 control window",
        `Day ${cycle.daysIntoCycle} of Month 1. The Coach unlocks automatically in ${cycle.daysRemainingInPhase} day${cycle.daysRemainingInPhase === 1 ? "" : "s"}. This is how the honest baseline is captured.`
      );
      return;
    }
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
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase.from("events").insert({
        company_id: companyId,
        actor: auth.user.id,
        kind: next ? "coach.enabled" : "coach.disabled",
        subject: `company:${companyId}`,
        payload: { enabled: next, scope: "company", cycle_phase: cycle?.phase },
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

  const recordSkip = async () => {
    if (!companyId || skipSaving) return;
    if (skipReason.trim().length < 20) {
      toast.warn(
        "Reason required",
        "≥20 chars so the readout has substance to attribute the override."
      );
      return;
    }
    setSkipSaving(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSkipSaving(false);
      return;
    }
    const skippedAt = new Date().toISOString();
    const { error } = await supabase
      .from("companies")
      .update({
        cycle_control_skipped_at: skippedAt,
        cycle_control_skipped_by: auth.user.id,
        cycle_control_skip_reason: skipReason.trim(),
      })
      .eq("id", companyId);
    if (error) {
      toast.error("Couldn't record skip", error.message);
      setSkipSaving(false);
      return;
    }
    // On-record audit event so the §4 readout can flag this
    // company as "skipped control" forever. Permanent by §3.1
    // append-only — never cleared.
    await supabase.from("events").insert({
      company_id: companyId,
      actor: auth.user.id,
      kind: "coach.control_skipped",
      subject: `company:${companyId}`,
      payload: {
        skipped_at: skippedAt,
        reason: skipReason.trim(),
        days_into_cycle: cycle?.daysIntoCycle ?? null,
      },
    });
    if (cycle) {
      setCycle(
        resolveCyclePhase({
          cycleStartedAt: new Date(
            new Date().getTime() - cycle.daysIntoCycle * 24 * 60 * 60 * 1000
          ).toISOString(),
          cycleControlSkippedAt: skippedAt,
        })
      );
    }
    setShowSkipForm(false);
    setSkipReason("");
    setSkipSaving(false);
    toast.success(
      "Control window skipped",
      "Recorded on the §3.1 chain. Coach unlocked — readout will flag this company."
    );
  };

  if (!supabaseEnabled) return null;

  const inControl = cycle?.phase === "control";

  return (
    <div className="glass-card p-5">
      <LearningHint
        as="block"
        category="Settings · Coach"
        title="Conversational Coach"
        whatItIs="A company-wide switch that lets the Coach surface a relevant principle as your team writes messages, tasks, feedback, and notes — as a citation, never a rewrite."
        why="Guidance that overtakes the author creates dependence instead of capability. The Coach cites and steps back so the person still authors their own words; every offer, accept, and dismiss is recorded so its real effect can be measured, not assumed."
        how="Read the state below the divider, then use the toggle. It only turns on once the control window has passed — that gate is deliberate, not a bug."
        principle="Guide, don't overtake — the coach cites the principle and the human keeps the pen.">
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
      </LearningHint>

      {/* §3.4 cycle banner — present whenever we know the phase. */}
      {cycle && (
        <div
          className={`mb-3 rounded-lg border p-3 ${
            inControl
              ? "border-arc-400/40 bg-arc-400/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <div className="flex items-start gap-2">
            <Hourglass
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                inControl ? "text-arc-300" : "text-emerald-300"
              }`}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-semibold ${
                  inControl ? "text-arc-300" : "text-emerald-300"
                }`}
              >
                {phaseLabel(cycle.phase)}
                {cycle.skippedControl && (
                  <span className="ml-2 text-[10px] text-accent-text uppercase tracking-widest">
                    · skipped control
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-secondary leading-relaxed">
                {inControl ? (
                  <>
                    Day {cycle.daysIntoCycle} of 30. The Coach is locked
                    OFF for the first month so the §4 readout has an
                    honest baseline of the team operating as themselves.
                    The Coach unlocks automatically in{" "}
                    <span className="text-primary font-semibold">
                      {cycle.daysRemainingInPhase} day
                      {cycle.daysRemainingInPhase === 1 ? "" : "s"}
                    </span>
                    .
                  </>
                ) : cycle.phase === "intervention" ? (
                  <>
                    Day {cycle.daysIntoCycle} of 60. Single-variable
                    intervention period — the Coach is the only thing
                    that changed from Month 1. {cycle.daysRemainingInPhase}{" "}
                    day{cycle.daysRemainingInPhase === 1 ? "" : "s"} until
                    the proof-checkpoint window closes; data continues
                    to accumulate after.
                  </>
                ) : (
                  <>
                    Day {cycle.daysIntoCycle} from cycle start. Past the
                    proof checkpoint — compounding upside. The readout
                    continues to attribute outcomes to Coach-on vs
                    Coach-off windows.
                  </>
                )}
              </p>
            </div>
          </div>

          {inControl && !showSkipForm && (
            <LearningHint
              as="inline-block"
              category="Settings · Coach"
              title="Override the control window"
              whatItIs="An escape hatch that ends the Month-1 baseline early and unlocks the Coach now, in exchange for a permanent on-record mark."
              why="The month-1 control exists so improvement can be attributed to the Coach and nothing else. Skipping it isn't forbidden, but it can't be silent — the skip is stamped on the chain forever so anyone reading the outcomes knows the baseline wasn't clean."
              how="Only use it when you have a real reason (e.g. a parallel measurement). Clicking it opens a form that requires a written justification before the skip is recorded."
              principle="Every shortcut around honesty must leave a mark you can't erase.">
              <button
                type="button"
                onClick={() => setShowSkipForm(true)}
                className="mt-2 ml-6 inline-flex items-center gap-1 text-[10px] text-muted hover:text-accent-text underline"
              >
                <ShieldAlert className="w-3 h-3" aria-hidden />
                Override (records a permanent skip mark)
              </button>
            </LearningHint>
          )}

          {inControl && showSkipForm && (
            <div className="mt-3 ml-6 border-l-2 border-accent-text/30 pl-3">
              <p className="text-[11px] text-accent-text font-semibold mb-1">
                You&apos;re about to skip the §3.4 control window.
              </p>
              <p className="text-[10px] text-secondary leading-relaxed mb-2">
                This is allowed but permanent. The skip stamp and your
                reason land on the chain forever. The §4 readout will
                flag this company so anyone reading the outcomes knows
                Month 1 did NOT capture a clean baseline. Use this only
                when you genuinely have a reason — e.g. you&apos;re running
                a parallel measurement, not because the toggle feels
                tempting today.
              </p>
              <LearningHint
                as="block"
                category="Settings · Coach"
                title="Skip reason"
                whatItIs="The written justification for ending the control window early — required, at least 20 characters, and kept permanently."
                why="A skip without a reason is just a bypass. The reason is what the outcomes readout attributes the override to later, so it has to carry substance, not a shrug."
                how="State the genuine reason in plain language. It's stored verbatim on the chain alongside who skipped and when — you can't edit it afterward."
                principle="If it's worth overriding a safeguard, it's worth writing down why.">
                <textarea
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder="Why are you skipping? (≥20 chars)"
                  className="w-full rounded-md bg-black/30 border border-white/10 px-2 py-1.5 text-[11px] text-primary focus:outline-none focus:border-accent-text/50"
                />
              </LearningHint>
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSkipForm(false);
                    setSkipReason("");
                  }}
                  disabled={skipSaving}
                  className="text-[10px] text-muted hover:text-primary disabled:opacity-40"
                >
                  Cancel
                </button>
                <LearningHint
                  as="inline-block"
                  category="Settings · Coach"
                  title="Record skip"
                  whatItIs="The commit action that writes the control-window skip — the stamp, your identity, and your reason — permanently to the chain and unlocks the Coach."
                  why="This is the point of no return. It's append-only by design: the skip can never be cleared, so the outcomes readout can flag this company as 'skipped control' for as long as it exists."
                  how="Enabled only once your reason is at least 20 characters. Click it and the Coach unlocks immediately; there's no undo, so be sure before you do."
                  principle="Irreversible actions should feel irreversible — that's the safeguard, not a flaw.">
                  <button
                    type="button"
                    onClick={recordSkip}
                    disabled={skipSaving || skipReason.trim().length < 20}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-text border border-accent-text/40 hover:border-accent-text/70 disabled:opacity-40 px-2 py-1 rounded"
                  >
                    {skipSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Record skip
                  </button>
                </LearningHint>
              </div>
            </div>
          )}
        </div>
      )}

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
        <LearningHint
          as="inline-block"
          category="Settings · Coach"
          title="Turn the Coach on / off"
          whatItIs="The company-wide switch for the Conversational Coach. When on, guidance surfaces across tasks, feedback, notes, and chat; when off, it only appears on chat topics that opted in per-topic."
          why="This is one lever with a real cost: flipping it on is the single change measured against the month-1 baseline. It stays disabled during the control window so that comparison stays clean, and each flip emits an event so the readout knows exactly when guidance was live."
          how="During Month 1 it's locked — the tooltip shows the days remaining. Once unlocked, click to turn on company-wide, or off to fall back to per-topic opt-in."
          principle="A single, dated, on-the-record switch is what makes the improvement attributable.">
          <button
            type="button"
            onClick={flip}
            disabled={
              loading ||
              saving ||
              enabled == null ||
              (inControl && !enabled) // can't turn ON in control
            }
            title={
              inControl && !enabled
                ? `Locked during §3.4 control — ${cycle?.daysRemainingInPhase ?? "?"} day${cycle?.daysRemainingInPhase === 1 ? "" : "s"} remaining`
                : undefined
            }
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
              enabled
                ? "border-ember-400/40 hover:border-ember-400/70 text-brand bg-ember-400/5"
                : "border-default hover:border-strong text-secondary"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {saving ? "Saving…" : enabled ? "Turn off" : "Turn on"}
          </button>
        </LearningHint>
      </div>
    </div>
  );
}
