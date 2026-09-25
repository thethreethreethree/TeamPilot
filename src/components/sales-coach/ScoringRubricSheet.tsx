"use client";

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import {
  BASE_MAX,
  BONUSES,
  BONUS_CAP,
  MAX_SCORE,
  PRIZE_ELIGIBLE_MIN_PITCHES,
  QUALIFYING_MIN_BASE,
  SECTIONS,
  VIOLATIONS,
  elementsForSection,
  type SectionId,
} from "@/lib/coach/pitchScore/rubric";

/**
 * "How points work" — the read-only scoring rubric.
 *
 * The guide's requirement is one line and it is the whole design constraint: "Scoring rubric:
 * read-only, rendered from rubric_config so it never goes stale." Nothing below is a hard-coded
 * list. Every section, element, bonus and violation is mapped from the config, so adding a bonus
 * to the rubric shows up here without anyone remembering to edit this file — which is exactly how
 * a rubric screen normally rots, and why the launch checklist bothers to include "Scoring rubric
 * screens match the live config".
 *
 * A SHEET, NOT A SCREEN. The founder's note corrects the build guide on this: page 4 of the rep
 * boards "will be the 'score rubric' button that is on page 1 and 2" — it opens over Progress and
 * Breakdown rather than being a fourth destination. The manager dashboard opens the same component
 * from its header button, so both roles read one rubric from one source.
 * See docs/SYSTEM UPDATES AND REVISION 09-22-2026/LOGIC-AND-CONTRADICTIONS.md B1.
 */

const GRADE_LEGEND = [
  { grade: "HIT", credit: "Full points.", meaning: "Point clearly made." },
  { grade: "PARTIAL", credit: "Half points.", meaning: "Rushed or vague." },
  { grade: "MISSED", credit: "0 points.", meaning: "Skipped." },
] as const;

/**
 * Competition rules, from the rubric's own "Competition rules and scoring formula" section.
 *
 * ONE WORD ADDED TO THE FOUNDER'S WORDING, and it is load-bearing. The rule reads "Leaderboard =
 * total points from counted pitches" — true of the PITCH SCORE competition, and not true of the
 * board a rep reaches from the nav today. Scoreboard ranks by the gamification ledger's
 * `total_points`, which is the mean of the v5 dimension scores × 10 (0-100 per session), not a
 * sum of pitch totals (0-130 per pitch). Different inputs, different scale, different number.
 *
 * Left unqualified, this sheet asserts as current fact something the product does not do, and a
 * rep who reads it and then opens Scoreboard sees a number computed from something else with no
 * explanation. That is the same shape as the band collision found earlier today, in shipped copy
 * rather than in code.
 *
 * The founder's rule is unchanged; it is now scoped to the competition it describes. Which
 * leaderboard the Scoreboard should show is the founder's decision, recorded in
 * docs/SYSTEM UPDATES AND REVISION 09-22-2026/TWO-SCORING-SYSTEMS.md.
 */
const competitionRules = [
  `A pitch counts only if it reaches Discovery and scores ${QUALIFYING_MIN_BASE}+ base points.`,
  "Pitch Score leaderboard = total points from counted pitches. (The Scoreboard tab still ranks by session points — the two are separate boards.)",
  "Best Pitch award goes to the highest single score.",
  `${PRIZE_ELIGIBLE_MIN_PITCHES} counted pitches minimum to be prize eligible.`,
  "A pitch never scores below 0. Think a score is wrong? Tap Dispute on the pitch.",
];

export function ScoringRubricSheet({ onClose }: { onClose: () => void }) {
  // Close is the default state for every section — the sheet is a reference, and six expanded
  // sections would bury the bonus and violation tables below two screens of scrolling.
  const [openSections, setOpenSections] = useState<Partial<Record<SectionId, boolean>>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="How points work"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-base border border-default sm:rounded-2xl rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-base border-b border-default">
          <div>
            <h2 className="text-sm font-semibold text-primary">How points work</h2>
            <p className="text-[11px] text-muted">EloState AT&amp;T Fiber pitch rubric</p>
          </div>
          {/* "Close rubric", not "Close": the rubric HAS a section called Close, and two buttons named
              the same thing in one dialog is a genuine ambiguity for anyone navigating by label. */}
          <button type="button" onClick={onClose} aria-label="Close rubric" className="text-muted hover:text-primary p-1">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* The arithmetic, stated once at the top so the rest reads as detail. */}
          <section className="rounded-xl border border-default bg-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Every pitch</p>
            <div className="flex items-end justify-between gap-2 text-center">
              <Figure value={String(BASE_MAX)} label="Base" tone="text-primary" />
              <Operator>+</Operator>
              <Figure value={String(BONUS_CAP)} label="Bonus cap" tone="text-emerald-400" />
              <Operator>−</Operator>
              <Figure value="Viol." label="Deductions" tone="text-rose-400" />
              <Operator>=</Operator>
              <Figure value={String(MAX_SCORE)} label="Max score" tone="text-brand" />
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              You don&apos;t need to say the script word for word. The AI listens for the point
              landing, in your own words.
            </p>
          </section>

          <section className="grid grid-cols-3 gap-2">
            {GRADE_LEGEND.map((g) => (
              <div key={g.grade} className="rounded-lg border border-default bg-surface p-2.5">
                <p className="text-[11px] font-bold text-primary">{g.grade}</p>
                <p className="text-[10px] text-secondary">{g.credit}</p>
                <p className="text-[10px] text-muted">{g.meaning}</p>
              </div>
            ))}
          </section>

          {/* BASE — every section and, expanded, every element. Mapped from config. */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
              Base · {BASE_MAX} points
            </p>
            <div className="space-y-1.5">
              {SECTIONS.map((section) => {
                const open = openSections[section.id] ?? false;
                const elements = elementsForSection(section.id);
                return (
                  <div key={section.id} className="rounded-lg border border-default bg-surface overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !open }))}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left"
                    >
                      <span className="text-sm font-semibold text-primary">{section.label}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-brand">{section.maxPoints} pts</span>
                        {open ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted" aria-hidden />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted" aria-hidden />
                        )}
                      </span>
                    </button>
                    {open && (
                      <div className="px-3.5 pb-3 space-y-2 border-t border-default pt-2.5">
                        {elements.map((el) => (
                          <div key={el.id} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-primary">{el.label}</p>
                              <p className="text-[10px] text-muted leading-snug">{el.whatCounts}</p>
                            </div>
                            <span className="text-xs text-secondary shrink-0">{el.points}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* BONUS */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
              Bonus · up to +{BONUS_CAP} per pitch
            </p>
            <div className="rounded-lg border border-default bg-surface divide-y divide-default">
              {BONUSES.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3 px-3.5 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-primary">{b.label}</p>
                    <p className="text-[10px] text-muted leading-snug">{b.detectionNotes}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 shrink-0">
                    +{b.points}
                    {b.repeatable ? " ea" : ""}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted leading-relaxed">
              All bonuses are detected from the recording. Inside/backyard is inferred from the
              conversation and room sound.
            </p>
          </section>

          {/* VIOLATIONS */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Violations</p>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] divide-y divide-rose-500/10">
              {VIOLATIONS.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-3 px-3.5 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-primary">{v.label}</p>
                    <p className="text-[10px] text-muted leading-snug">{v.trigger}</p>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 shrink-0">
                    −{v.deduction}
                    {v.repeatable ? " ea" : ""}
                    {v.maxTotal ? ` · max −${v.maxTotal}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Competition rules</p>
            <ul className="rounded-lg border border-default bg-surface px-4 py-3 space-y-1.5">
              {competitionRules.map((rule) => (
                <li key={rule} className="text-[11px] text-secondary leading-relaxed">
                  {rule}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="flex-1">
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Operator({ children }: { children: React.ReactNode }) {
  return <span className="pb-4 text-sm text-muted">{children}</span>;
}
