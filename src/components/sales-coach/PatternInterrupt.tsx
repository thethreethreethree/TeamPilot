"use client";

import { useState } from "react";
import { Repeat, Info } from "lucide-react";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";

/**
 * Pattern Interrupt — Project 5 of the 2026-09-19 coaching build.
 *
 * WHAT IS HERE AND WHAT IS NOT, stated plainly because the difference matters:
 *
 * The screen, its role split and its explainer are built from the mockups. The DATA is not.
 *
 * CORRECTED 2026-09-21, because the original reason stopped being true. This file used to say
 * detection could not run because `pitch_elements` and `pitch_events` did not exist until the
 * Pitch Score engine landed. The engine HAS landed — migration 0252 — and it created exactly the
 * inputs a detector needs: `pitch_score_elements` (the per-element grade behind every score,
 * indexed on `(company_id, element_id)`, which is the index the detection query wants) and
 * `pitch_score_events`. The names in the old note were wrong and the dependency it named is met.
 *
 * What is actually missing is the other half, and 0252's own header says so: `patterns` and
 * `pattern_events` were deliberately deferred to ship WITH this feature. So there is no storage
 * for a detected pattern and no detector to write one. The guide's build order
 * (`A[1. Pitch Score engine] --> E[5. Pattern Interrupt]`) has had its precondition satisfied;
 * the work it gates has not been done.
 *
 * The distinction is not pedantry. The old empty state promised a manager that this page would
 * fill in once scoring went live. Scoring IS live, pitches are being scored, and the page will
 * stay at zero forever until someone writes the detector — which is a promise that had quietly
 * become false while every test still passed.
 *
 * So this renders the real shell over an honest empty state rather than sample data. Showing the
 * mockup's numbers (12 active patterns, Humza Khan at 5 of 7) would mean a manager reading
 * fabricated coaching about real reps — which is the one failure this product exists to prevent.
 * The counts below are zeros with a stated reason, not placeholders dressed as findings.
 *
 * WHAT THE DETECTOR MUST DO (guide Step 5 / Step 6), recorded so the next author does not
 * re-derive it — and no longer gated on anything, since Project 1 landed:
 *   - Detect: per rep, per rubric element / bonus / violation, over the last 10 APPLICABLE pitches.
 *     Missed in 3+ opens a pattern with status New. Pitches where the item did not apply are
 *     skipped entirely — the dot strip is therefore min(10, applicable), which is why the mockup
 *     shows seven dots and reads "5 of 7".
 *   - Cost: average points lost per applicable pitch, frozen at detection; it becomes "points
 *     recovered" once the pattern is fixed.
 *   - Statuses: New -> Coaching -> Improving / Stalled -> Fixed. Fixed clears automatically after
 *     5 clean applicable pitches in a row; Stalled means coached 7+ days ago with no clean streak
 *     and no improvement.
 *   - Team-wide: 3+ reps sharing one item promotes the pattern to the top with "Add to team brief".
 *
 * One definition to keep straight, because the mockups use the word two ways: OPEN means
 * status is anything other than Fixed. The manager rep-chips and the rep-detail panel count
 * Improving as open (Anthony A. = 3); the rep-progress list's third number excludes it
 * ("1 fixed · 1 improving · 2 open"). Same rep, same moment, two numbers. Whatever is built must
 * pick the first sense and LABEL the second, or the two screens contradict each other on screen.
 * See docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md C8.
 */

type Tab = "patterns" | "rep-progress";

const COUNTS = [
  { label: "Active patterns", hint: "Across the team" },
  { label: "New this week", hint: "Not coached yet" },
  { label: "Improving", hint: "Trending the right way" },
  { label: "Fixed this month", hint: "5 clean pitches in a row" },
] as const;

export function PatternInterrupt() {
  const isManager = useIsSalesCoachManager();
  const [tab, setTab] = useState<Tab>("patterns");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 border-b border-default">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-brand" aria-hidden />
          <h1 className="text-base font-semibold text-primary">Pattern Interrupt</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Repeated misses from the recordings, with the clips to prove it
        </p>
      </div>

      {/* Manager gets two tabs; a rep sees only their own patterns, so the tab row would be a
          control with one option. */}
      {isManager && (
        <div className="px-5 pt-3 flex items-center gap-4 border-b border-default">
          {([
            ["patterns", "Patterns"],
            ["rep-progress", "Rep progress"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === value
                  ? "border-ember-400 text-primary"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-ember-400/30 bg-ember-400/[0.06] px-3.5 py-3">
          <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-secondary leading-relaxed">
            <span className="font-semibold text-primary">Patterns, not one-off mistakes.</span>{" "}
            A pattern appears when the same miss shows up in 3 or more of a rep&apos;s last 10
            pitches.{" "}
            {isManager
              ? "Reps see their own Pattern Interrupt page, clips and your notes included, so nothing here is a surprise."
              : "Your manager sees this same page. Use the clips to hear it for yourself, then practice the fix in Role Play."}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {COUNTS.map((c) => (
            <div key={c.label} className="rounded-lg border border-default bg-surface px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-muted">0</p>
              <p className="text-[10px] text-muted">
                {isManager ? c.hint : c.label === "Active patterns" ? "Yours right now" : c.hint}
              </p>
            </div>
          ))}
        </div>

        {/* The honest empty state. It names the dependency rather than implying the rep has no
            patterns — "none found" and "not looked yet" are different facts, and a manager acting
            on the wrong one coaches nobody. */}
        <div className="rounded-lg border border-default bg-surface px-5 py-8 text-center">
          <p className="text-sm text-primary font-medium">Detection is not running yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted leading-relaxed">
            Patterns are found by comparing every scored pitch against the rubric. Pitches are
            being scored — that part is live — but the comparison that turns repeated misses into
            a tracked pattern has not been built yet. Nothing is wrong with{" "}
            {isManager ? "your team" : "your pitches"}; nothing has looked.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] text-muted">
            This screen deliberately shows zeros instead of example data, so no one coaches from a
            number that was never measured.
          </p>
        </div>
      </div>
    </div>
  );
}
