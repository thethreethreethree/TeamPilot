"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Lock,
  ClipboardCheck,
  ThumbsUp,
  Lightbulb,
  Star,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { TeamTrainingBriefPanel } from "@/components/sales-coach/TeamTrainingBriefPanel";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { AgentEloBadge } from "@/components/sales-coach/AgentEloBadge";
import { AgentGradeBadge } from "@/components/sales-coach/AgentGradeBadge";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";

/**
 * Sales Coach → Coach Assessment (admin/manager). Per-agent coaching signal
 * pulled from each agent's own Dissect evaluations (what they're doing well and
 * where to grow) PLUS the Sales ELO Rating — a gamified score of each rep against
 * our measurement standard (1500), NOT a peer leaderboard (founder 2026-07-07).
 * §A18/§A10 visibility: admins + managers see the team's ratings here; each rep
 * sees their OWN on Analytics (no shadow read). The coaching NOTES stay
 * comparison-free — measured against the rep's own growth. Order is alphabetical,
 * never by rating (§A11 — not a rank). §3.4 — real text from the dissects.
 */

type AgentAssessment = {
  agentId: string;
  agentName: string;
  dissectCount: number;
  strengths: string[];
  growthAreas: string[];
  strategies: string[];
  lastAt: string | null;
  // All-time door activity (founder 2026-08-26). null when the KPI read failed (shown as nothing, not a false 0).
  doorKpi: { doorsKnocked: number; presentations: number; sold: number } | null;
};

// Compact per-rep door-activity row for the manager view — objective ACTIVITY (knocked / presentations / sold),
// distinct from the coaching grade. Renders nothing when there's no activity so a quiet rep's card stays clean.
function DoorMetrics({ kpi }: { kpi: AgentAssessment["doorKpi"] }) {
  if (!kpi || kpi.doorsKnocked <= 0) return null;
  const items: [string, number][] = [
    ["knocked", kpi.doorsKnocked],
    ["presentations", kpi.presentations],
    ["sold", kpi.sold],
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      <span aria-hidden>🚪</span>
      {items.map(([label, n], i) => (
        <span key={label} className="tabular-nums">
          <span className="font-semibold text-primary">{n}</span> {label}
          {i < items.length - 1 ? <span className="text-muted/50"> ·</span> : null}
        </span>
      ))}
    </div>
  );
}

export default function CoachAssessmentPage() {
  const [team, setTeam] = useState<AgentAssessment[] | null>(null);
  const [isManager, setIsManager] = useState(true);
  const [loading, setLoading] = useState(true);
  // §3.4: a server-side query failure is shown as an honest error, NOT as
  // an empty team (which would be indistinguishable from "no assessments").
  const [degraded, setDegraded] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  // Per-agent card collapse (founder 2026-07-10 annotated spec): each agent's
  // dissect detail (strategy tags + doing-well + coaching-focus) is collapsed by
  // default so the roster is scannable; clicking the agent's ELO badge reveals it.
  // Keyed by agentId so each card toggles independently.
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const toggleAgent = useCallback((id: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // Experience Mode (founder 2026-07-10 clarification): Standard MINIMIZES what an
  // agent sees — so the dissect detail is collapsed by default here. Expert is the
  // FULL system, nothing collapsed — so Expert always renders expanded and shows no
  // collapse chrome. The click-to-reveal exists only in Standard.
  const { isExpert } = useExperienceMode();

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/coach/sales-session/coach-assessment"
      ).catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) {
          setDegraded(true);
        } else {
          setTeam(d.team ?? []);
        }
      } else if (res && res.status === 403) {
        setIsManager(false);
      } else {
        setDegraded(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Backfill: regenerate dissects for sessions that have a transcript but no
  // dissect yet (the M3 safety net). Batched — run until "0 remaining".
  const runBackfill = useCallback(async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch(
        "/api/coach/sales-session/backfill-dissects",
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`failed (${res.status})`);
      const d = await res.json();
      setBackfillMsg(
        `Generated ${d.generated ?? 0}${d.thinOrFailed ? `, ${d.thinOrFailed} too thin` : ""}. ${d.remaining ?? 0} still to generate${
          d.noContent ? ` · ${d.noContent} session${d.noContent === 1 ? "" : "s"} had no audio captured (nothing to assess)` : ""
        }.`
      );
      await load();
    } catch {
      // Manager-facing (the "Generate missing" button) — plain English, not "backfill" jargon.
      setBackfillMsg("Couldn't generate the missing reviews right now — please try again.");
    } finally {
      setBackfilling(false);
    }
  }, [load]);

  const withContent = (team ?? []).filter((a) => a.dissectCount > 0);
  const noContent = (team ?? []).filter((a) => a.dissectCount === 0);

  return (
    <>
      <TopBar title="Coach Assessment" subtitle="How the team is growing" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-4 bg-base">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : degraded ? (
          <LearningHint
            as="block"
            category="Sales Coach · Assessment"
            title="Load error, not empty team"
            whatItIs="An honest error state: the assessment query failed, so the page shows this instead of a blank team."
            why="An empty team and a failed load look identical, but mean opposite things. Showing the error keeps you from coaching off a false 'nobody's growing' when the truth is 'we couldn't load it.'"
            how="Treat this as temporary — retry shortly. Don't read it as a real state of the team."
            principle="A silent empty screen can lie; an honest error can't."
          >
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
              <p className="text-xs text-amber-300">
                Couldn&apos;t load the team assessment right now — this is an
                error, not an empty team. Try again shortly.
              </p>
            </div>
          </LearningHint>
        ) : !isManager ? (
          <LearningHint
            as="block"
            category="Sales Coach · Assessment"
            title="Admin-only overview"
            whatItIs="An access gate: the team coaching overview is visible to admins only. Reps see their own growth under Analytics instead."
            why="One rep seeing another rep's coaching signal would turn a private growth tool into a comparison — the exact ranking dynamic this feature refuses. The gate protects that."
            how="If you're a rep, head to Analytics for your own read. If you should have admin access and don't, that's a permissions issue to raise."
            principle="Growth data stays private per person, or it quietly becomes a leaderboard."
          >
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-5">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-3">
                <Lock className="w-3 h-3" aria-hidden />
                Admin only
              </div>
              <h2 className="text-sm font-semibold text-primary mb-1">
                Coach Assessment is admin-only
              </h2>
              <p className="text-xs text-secondary leading-relaxed">
                This is the admin&apos;s coaching overview of the team. Your own
                growth lives under Analytics.
              </p>
            </div>
          </LearningHint>
        ) : (
          <>
            <LearningHint
              as="block"
              category="Sales Coach · Assessment"
              title="Coaching notes + your ELO rating"
              whatItIs="Two things live here: the coaching NOTES (Doing well / Coaching focus, drawn from each person's own Dissects) and the Sales ELO Rating (a gamified score of each rep against our measurement standard, not against peers)."
              why="The coaching notes are never a leaderboard — a leaderboard makes reps optimize for looking good instead of getting better. The ELO is deliberately different: a game you play against a fixed standard (1500), so climbing means beating the standard, not out-scoring a teammate. Admins and managers see the team's; each rep sees their own on Analytics."
              how="Read each agent's coaching notes on their own terms. Read the ELO as their trajectory against the standard over time — a rising number is real progress, not a rank."
              principle="Measure people against a standard and their own growth, never against each other — that's what keeps a score motivating instead of political."
            >
              <div className="flex items-start gap-2 rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
                <ClipboardCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                <p className="text-xs text-secondary leading-relaxed">
                  Each person&apos;s coaching signal is drawn from their own
                  conversations — auto-built from their Dissects when sessions
                  end.{" "}
                  <span className="text-primary">The notes are for coaching, not
                  ranking</span>
                  : everyone is measured against their own growth, never each
                  other. The{" "}
                  <span className="text-primary">{isExpert ? "Sales ELO Rating" : "coaching grade"}</span>
                  {isExpert
                    ? " is a gamified score of each rep against our measurement standard (1500)"
                    : " is a letter summarizing each rep’s calls against our competent-call standard"}
                  {" — never against peers. Admins and managers see the team’s; each rep sees their own."}
                </p>
              </div>
            </LearningHint>

            <div className="flex items-center justify-between gap-2">
              <LearningHint
                as="block"
                category="Sales Coach · Assessment"
                title="Backfill status"
                whatItIs="Reports what the last 'Generate missing' run did — how many assessments it built, how many were too thin to use, and how many are still missing."
                why="A backfill that silently 'succeeds' with zero output hides a problem. Reporting the real counts — including thin/failed ones — keeps you honest about how complete the team's data actually is."
                how="If it says sessions are still missing, run 'Generate missing' again until it reaches zero."
                principle="Trust the count that admits what it couldn't do, not the one that only reports success."
              >
                <p className="text-[11px] text-muted">
                  {backfillMsg ??
                    "Regenerate any dissects that didn't auto-generate (e.g. a closed tab)."}
                </p>
              </LearningHint>
              <LearningHint
                as="inline-block"
                category="Sales Coach · Assessment"
                title="Generate missing"
                whatItIs="Regenerates the Dissect for any completed session that has a transcript but never got assessed — usually because a rep closed the tab before it finished."
                why="Assessments normally build themselves when a session ends. This safety net exists so a dropped connection doesn't silently leave a rep's growth data with a hole in it."
                how="Run it when the status text says sessions are still missing; it works in batches, so run it again until it reports 0 remaining."
                principle="A gap in the data reads as 'no growth' — better to backfill it than to coach from a false blank."
              >
                <LoadingButton
                  pending={backfilling}
                  onClick={() => void runBackfill()}
                  icon={<ClipboardCheck className="w-3.5 h-3.5" aria-hidden />}
                  pendingLabel="Generating…"
                  className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold border border-default text-secondary hover:text-primary px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Generate missing
                </LoadingButton>
              </LearningHint>
            </div>

            {/* Team Training Brief (founder 2026-08-26) — shared panel, also on the Training tab. */}
            <div className="mb-4">
              <TeamTrainingBriefPanel />
            </div>

            {withContent.length === 0 && (
              <LearningHint
                as="block"
                category="Sales Coach · Assessment"
                title="No assessments yet"
                whatItIs="An honest empty state: no one has finished a dissected session yet, so there's genuinely nothing to coach from."
                why="This is the real 'nothing here yet,' distinct from the load error above. It tells you the data pipeline is fine — the team just hasn't generated signal yet."
                how="Wait for the team to finish sessions; each completed one is dissected automatically and will populate here. Nothing to do."
                principle="An honest 'nothing yet' is data too — it says the system works and the work hasn't happened."
              >
                <p className="text-xs text-muted py-8 text-center">
                  No assessments yet. They appear here as the team finishes
                  sessions (each completed session is dissected automatically).
                </p>
              </LearningHint>
            )}

            {withContent.map((a, cardIdx) => {
              const isFirstCard = cardIdx === 0;
              // Expert: always expanded (full system). Standard: collapsed until the
              // user clicks this agent's ELO badge to reveal.
              const isExpanded = isExpert || expandedAgents.has(a.agentId);
              const dissectBadge = (
                <span className="text-[10px] text-muted">
                  {a.dissectCount} session{a.dissectCount === 1 ? "" : "s"} dissected
                </span>
              );
              return (
              <section
                key={a.agentId}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-primary">
                    {a.agentName}
                  </h2>
                  {isFirstCard ? (
                    <LearningHint
                      as="inline-block"
                      category="Sales Coach · Assessment"
                      title="Sessions dissected"
                      whatItIs="How many of this rep's conversations the coach has assessed so far — the evidence base behind everything on their card."
                      why="A read built on two calls is not the same as one built on twenty. Showing the count tells you how much to trust the pattern, instead of over-reading a fluke."
                      how="Weight a card with more sessions more heavily; on a low count, treat the strengths and focuses as early signals, not settled facts."
                      principle="Coach the pattern, not the anecdote — and the count tells you which one you're looking at."
                    >
                      {dissectBadge}
                    </LearningHint>
                  ) : (
                    dissectBadge
                  )}
                </div>

                {/* Per-rep door activity (founder 2026-08-26 "show their door metrics on the manager dashboard"). */}
                <DoorMetrics kpi={a.doorKpi} />

                {/* Agent Sales Effectivity Rating (founder 2026-07-07) — ELO vs.
                    the standard, NOT a leaderboard. Cards stay alphabetical (never
                    sorted by rating) so this doesn't become the ranking the page
                    refuses (§A11/§A18). */}
                {/* Expert: plain badge, full detail below (nothing collapsed).
                    Standard: the ELO badge is the collapse trigger — clicking it
                    reveals/hides this agent's coaching detail. role=button (not
                    <button>) because AgentEloBadge contains its own <button>; that
                    inner button stops propagation so "explain" doesn't also toggle
                    the card. (founder 2026-07-10 annotated spec + Standard clarification) */}
                {isExpert ? (
                  <div className="mb-3">
                    <AgentEloBadge agentId={a.agentId} />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Hide" : "Show"} coaching detail for ${a.agentName}`}
                    onClick={() => toggleAgent(a.agentId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleAgent(a.agentId);
                      }
                    }}
                    className="mb-3 flex items-center gap-2 cursor-pointer rounded-lg -mx-1 px-1 py-1 transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-ember-400/50"
                  >
                    {/* Standard (founder 2026-07-22): letter grade, not the raw ELO number. */}
                    <AgentGradeBadge agentId={a.agentId} />
                    <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[10px] text-muted">
                      {isExpanded ? (
                        <>
                          <ChevronDown className="w-3 h-3" aria-hidden /> Hide detail
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3 h-3" aria-hidden /> Show detail
                        </>
                      )}
                    </span>
                  </div>
                )}

                {isExpanded && (
                <>
                {a.strategies.length > 0 &&
                  (isFirstCard ? (
                    <LearningHint
                      as="block"
                      category="Sales Coach · Assessment"
                      title="Strategy tags"
                      whatItIs="The recurring approaches this rep leans on, surfaced from their own conversations — their signature moves, in their own patterns."
                      why="Naming a rep's actual strategies lets you coach with their style instead of against it. Generic advice ignores how this specific person already sells."
                      how="Use these to frame your coaching: build on the strategies that are working, and notice which ones might be behind a recurring focus area."
                      principle="Coach the seller you have, not a generic one — their patterns are the starting point."
                    >
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {a.strategies.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] text-brand border border-ember-400/40 bg-ember-400/[0.06] rounded-full px-2 py-0.5"
                          >
                            <Star className="w-2.5 h-2.5" aria-hidden />
                            {s}
                          </span>
                        ))}
                      </div>
                    </LearningHint>
                  ) : (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {a.strategies.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] text-brand border border-ember-400/40 bg-ember-400/[0.06] rounded-full px-2 py-0.5"
                        >
                          <Star className="w-2.5 h-2.5" aria-hidden />
                          {s}
                        </span>
                      ))}
                    </div>
                  ))}

                <div className="grid md:grid-cols-2 gap-4">
                  {isFirstCard ? (
                    <LearningHint
                      as="block"
                      category="Sales Coach · Assessment"
                      title="Doing well"
                      whatItIs="What this rep is consistently getting right across their conversations, pulled from their own Dissects — not generic praise."
                      why="Coaching that only names faults teaches reps to hide their calls. Leading with real strengths is what makes the growth advice beside it safe to hear and act on."
                      how="Open your coaching conversation here — name a strength first, then the focus lands as a build, not an attack."
                      principle="Coach from what's working, or the person stops showing you the work."
                    >
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">
                          <ThumbsUp className="w-3 h-3" aria-hidden />
                          Doing well
                        </p>
                        {a.strengths.length === 0 ? (
                          <p className="text-[11px] text-muted">—</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {a.strengths.map((s, i) => (
                              <li key={i} className="text-xs text-secondary leading-relaxed">
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </LearningHint>
                  ) : (
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">
                        <ThumbsUp className="w-3 h-3" aria-hidden />
                        Doing well
                      </p>
                      {a.strengths.length === 0 ? (
                        <p className="text-[11px] text-muted">—</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {a.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-secondary leading-relaxed">
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {isFirstCard ? (
                    <LearningHint
                      as="block"
                      category="Sales Coach · Assessment"
                      title="Coaching focus"
                      whatItIs="Where this rep has the most room to grow, drawn from patterns across their own calls — the place your coaching time pays off most."
                      why="This is 'focus,' not 'faults,' on purpose. Framing growth as a direction to work rather than a verdict is what keeps the rep leaning in instead of defending."
                      how="Pick the one focus that recurs most and coach it against a concrete next call — don't try to fix the whole list at once."
                      principle="A focus points somewhere to go; a verdict just says where you failed. Coach the first."
                    >
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-2">
                          <Lightbulb className="w-3 h-3" aria-hidden />
                          Coaching focus
                        </p>
                        {a.growthAreas.length === 0 ? (
                          <p className="text-[11px] text-muted">—</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {a.growthAreas.map((g, i) => (
                              <li key={i} className="text-xs text-secondary leading-relaxed">
                                {g}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </LearningHint>
                  ) : (
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-2">
                        <Lightbulb className="w-3 h-3" aria-hidden />
                        Coaching focus
                      </p>
                      {a.growthAreas.length === 0 ? (
                        <p className="text-[11px] text-muted">—</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {a.growthAreas.map((g, i) => (
                            <li key={i} className="text-xs text-secondary leading-relaxed">
                              {g}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                </>
                )}
              </section>
              );
            })}

            {noContent.length > 0 && (
              <LearningHint
                as="block"
                category="Sales Coach · Assessment"
                title="Team members with no sessions yet"
                whatItIs="The people on the team who haven't run a dissected session, so they have no coaching card above yet."
                why="Listing them makes the gap visible instead of silent. A rep who has never been assessed is easy to forget — and 'never coached' is exactly who you'd want to notice."
                how="Use this as a nudge — reach out to the reps here to get their first sessions captured so they start appearing above."
                principle="The person with no data isn't doing fine — they're just invisible until you look."
              >
                {/* Per-rep so an active rep with no COACHED session (e.g. audio didn't capture) still shows their
                    door activity — they're working, just not yet assessable (founder 2026-08-26). */}
                <div className="text-[11px] text-muted">
                  <p className="mb-1">No coached sessions yet:</p>
                  <ul className="space-y-1">
                    {noContent.map((a) => (
                      <li key={a.agentId} className="flex flex-wrap items-center gap-x-2">
                        <span className="text-primary">{a.agentName}</span>
                        {a.doorKpi && a.doorKpi.doorsKnocked > 0 ? (
                          <span className="tabular-nums">
                            🚪 <span className="font-semibold text-primary">{a.doorKpi.doorsKnocked}</span> knocked ·{" "}
                            <span className="font-semibold text-primary">{a.doorKpi.presentations}</span> presentations ·{" "}
                            <span className="font-semibold text-primary">{a.doorKpi.sold}</span> sold
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </LearningHint>
            )}
          </>
        )}
      </div>
    </>
  );
}
