"use client";

import { useCallback, useEffect, useState } from "react";
import { Repeat, Info, Users } from "lucide-react";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import type { PatternStatus } from "@/lib/coach/patterns/status";
import type { Grade } from "@/lib/coach/pitchScore/rubric";

/**
 * Pattern Interrupt — Project 5 of the 2026-09-19 coaching build.
 *
 * Built from the boards, opened and read 2026-09-22: `Pattern Interrupt  rep (web).pdf` and
 * `Pattern Interrupt  manager Patterns (web).pdf`, recorded in
 * `docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md`.
 *
 * WHAT CHANGED WHEN THE BOARDS WERE ACTUALLY LOOKED AT. The previous version of this file was a
 * header, an explainer and four hardcoded zeros over an empty state — and the empty state
 * explained itself with a dependency that had already been satisfied. The boards have a
 * two-column body under all of that: pattern cards with a dot strip on the left, a detail panel
 * on the right. None of it existed here and nothing said so, which is the A31 seam exactly —
 * a correct system that is silently not a feature.
 *
 * OPEN IS A FIELD, NEVER AN EXPRESSION. C8 recorded two mockup screens counting "open"
 * differently for the same rep at the same moment; the founder ruled 2026-09-22 that
 * open = status ≠ Fixed. `statusOf` is the single author and the route hands both counts down
 * already computed. Nothing here writes `status !== "fixed"` (§2.2) — that one-line derivation
 * is precisely the kind that gets retyped per surface, and the retyped copy is how C8 happened.
 *
 * STILL NOT BUILT, and the screen says so rather than faking it: the Rep progress tab, the
 * manager's rep chips, and the clips inside the detail panel. Clips need `pitch_score_events`
 * timestamps wired to the recording player, which is Project 4. The mockup's sample numbers
 * (12 active patterns, Humza Khan at 5 of 7) shown to a manager would be fabricated coaching
 * about real people, which is the one failure this product exists to prevent.
 */

type Tab = "patterns" | "rep-progress";

type Wire = {
  patterns: PatternRow[];
  counts: {
    open: number;
    fixed: number;
    improving: number;
    isNew: number;
    stalled: number;
    openNotImproving: number;
  };
  teamWide: Array<{ itemId: string; label: string; repIds: string[] }>;
  capped: boolean;
  scored: boolean;
};

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; wire: Wire };

/** The board's status pills, in its own words. */
const PILL: Record<PatternStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  coaching: { label: "Coaching", className: "bg-ember-400/20 text-brand" },
  improving: { label: "Improving", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  stalled: { label: "Stalled", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  fixed: { label: "Fixed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

/**
 * The dot strip.
 *
 * C4 on why it is usually shorter than ten: the board shows SEVEN dots reading "5 of 7", because
 * that rep has seven applicable pitches. Padding to ten would draw dots for pitches where the
 * item never came up, which is inventing evidence — and it would do it worst to the newest reps,
 * who are least able to tell a real finding from an artefact.
 */
function DotStrip({ strip }: { strip: readonly Grade[] }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {strip.map((g, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-[3px] ${
            g === "missed" ? "bg-red-500" : g === "hit" ? "bg-emerald-500" : "bg-ember-400"
          }`}
        />
      ))}
    </div>
  );
}

function CountCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-default bg-surface px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? "text-primary"}`}>{value}</p>
      <p className="text-[10px] text-muted">{hint}</p>
    </div>
  );
}

export function PatternInterrupt() {
  const isManager = useIsSalesCoachManager();
  const [tab, setTab] = useState<Tab>("patterns");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/coach/sales-session/patterns");
      if (!res.ok) {
        setState({ kind: "failed" });
        return;
      }
      const wire = (await res.json()) as Wire;
      setState({ kind: "ready", wire });
      setSelectedId((prev) => prev ?? wire.patterns[0]?.id ?? null);
    } catch {
      setState({ kind: "failed" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wire = state.kind === "ready" ? state.wire : null;
  const selected = wire?.patterns.find((p) => p.id === selectedId) ?? wire?.patterns[0] ?? null;

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

        {tab === "rep-progress" ? (
          <div className="rounded-lg border border-default bg-surface px-5 py-8 text-center">
            <p className="text-sm text-primary font-medium">Rep progress is not built yet</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted leading-relaxed">
              Its board shows a month timeline per pattern, an auto-built check-in agenda and
              days-to-fix across the team. The Patterns tab beside it is live.
            </p>
          </div>
        ) : state.kind === "loading" ? (
          <p className="py-8 text-center text-xs text-muted">Loading patterns…</p>
        ) : state.kind === "failed" || !wire ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-5 py-6 text-center">
            <p className="text-sm text-primary font-medium">Patterns could not be loaded</p>
            {/* NOT an empty state. "No patterns" and "we could not look" are opposite facts, and
                on this screen the wrong one reads as praise. */}
            <p className="mx-auto mt-2 max-w-md text-xs text-muted">
              This is a failure to read them, not a finding that there are none.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-md border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* The board's four. Each reads a count the resolver already produced rather than
                  filtering the list here — a second filter is a second definition of open (C8). */}
              <CountCard
                label="Active patterns"
                value={wire.counts.open}
                hint={isManager ? "Across the team" : "Yours right now"}
              />
              <CountCard
                label="New this week"
                value={wire.counts.isNew}
                hint="Not coached yet"
                tone={wire.counts.isNew > 0 ? "text-red-600 dark:text-red-400" : undefined}
              />
              <CountCard
                label="Improving"
                value={wire.counts.improving}
                hint="Trending the right way"
                tone={wire.counts.improving > 0 ? "text-emerald-700 dark:text-emerald-400" : undefined}
              />
              <CountCard label="Fixed" value={wire.counts.fixed} hint="5 clean pitches in a row" />
            </div>

            {wire.capped && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                More patterns than one read returns, so these counts cover only part of them.
              </p>
            )}

            {/* TEAM-WIDE — 3+ reps on one item. "When 3+ reps share a pattern it's a training gap,
                not a rep problem." Only ever populated on a team-scoped read. */}
            {wire.teamWide.map((t) => (
              <div key={t.itemId} className="flex items-start gap-2.5 rounded-lg border border-default bg-surface px-3.5 py-3">
                <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-brand">Team-wide pattern</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-primary">{t.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {t.repIds.length} reps share this. It is a training gap, not a rep problem —
                    worth one team session.
                  </p>
                </div>
              </div>
            ))}

            {wire.patterns.length === 0 ? (
              <div className="rounded-lg border border-default bg-surface px-5 py-8 text-center">
                {/* The two facts that look identical on screen and are opposite. */}
                <p className="text-sm text-primary font-medium">
                  {wire.scored ? "No patterns right now" : "Nothing has been scored yet"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs text-muted leading-relaxed">
                  {wire.scored
                    ? `Nothing has been missed in 3 or more of ${isManager ? "a rep's" : "your"} last 10 pitches where it applied. That is a finding, not an absence of one.`
                    : `Patterns come from scored pitches. Once ${isManager ? "your team's" : "your"} recordings are scored against the rubric, repeated misses show up here.`}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    {isManager ? "Patterns" : "Your patterns"}
                  </p>
                  {wire.patterns.map((p) => {
                    const active = p.id === selected?.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full rounded-lg border px-3.5 py-3 text-left transition-colors ${
                          active
                            ? "border-ember-400 bg-ember-400/[0.06]"
                            : "border-default bg-surface hover:border-ember-400/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[9px] uppercase tracking-widest text-muted">
                            {p.section ?? "rubric"}
                          </p>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${PILL[p.verdict.status].className}`}
                          >
                            {PILL[p.verdict.status].label}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] font-semibold text-primary">{p.label}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <DotStrip strip={p.strip} />
                          <p className="text-[10px] text-muted tabular-nums">
                            {p.missesAtDetection} of {p.applicableAtDetection} ·{" "}
                            <span className="text-red-600 dark:text-red-400">
                              −{p.costPerPitch} pts/pitch
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-[2px] bg-red-500" />Missed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-[2px] bg-emerald-500" />Done right
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-[2px] bg-ember-400" />Partial
                    </span>
                  </div>
                </div>

                {selected && (
                  <div className="rounded-lg border border-default bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted">
                        {selected.section ?? "rubric"}
                      </p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${PILL[selected.verdict.status].className}`}
                      >
                        {PILL[selected.verdict.status].label}
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-primary leading-snug">
                      {selected.label}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Missed in {selected.missesAtDetection} of {selected.applicableAtDetection}{" "}
                      pitches · open {selected.daysOpen} {selected.daysOpen === 1 ? "day" : "days"} ·
                      costing about{" "}
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        {selected.costPerPitch} pts per pitch
                      </span>
                    </p>

                    {/* The verdict's own reason, shown rather than re-phrased here. A status a rep
                        cannot argue with is not evidence. */}
                    <p className="mt-3 rounded-md border border-default bg-base/40 px-3 py-2 text-xs text-secondary">
                      {selected.verdict.reason}
                    </p>

                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-widest text-muted">Path to fixed</p>
                      <p className="mt-1 text-xs text-secondary">
                        Done right in 5 pitches in a row. Clears automatically.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${
                              i < selected.verdict.streak ? "bg-emerald-500" : "bg-default"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-primary tabular-nums">
                        {selected.verdict.streak} of 5 clean pitches in a row
                      </p>
                    </div>

                    {/* NAMED, NOT FAKED. The board puts three clips here with play buttons; they
                        need pitch_score_events timestamps wired to the recording player, which is
                        Project 4. Sample clips would be fabricated evidence about a real rep. */}
                    <p className="mt-4 text-[11px] text-muted">
                      The clips that prove this pattern arrive with the recording player (Project 4).
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
