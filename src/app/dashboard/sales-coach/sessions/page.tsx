"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Search,
  Video,
  MapPin,
  Sparkles,
  FileText,
  Star,
  Mic,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  Brain,
  Lightbulb,
  ChevronDown,
  AlertTriangle,
  Award,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Modal from "@/components/ui/Modal";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";
import type { SessionFlag } from "@/lib/coach/v5/sessionFlag";
import {
  DeckCard,
  DeckPill,
  DeckStat,
  SectionLabel,
  Sparkline,
  DeckGhostButton,
} from "@/components/sales-coach/ui/deck";
import { LinkProgress } from "@/components/sales-coach/ui/NavigationProgress";
import { LearningHint } from "@/components/learning/LearningHint";
import { StartSessionPanel } from "@/components/sales-coach/StartSessionPanel";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import { StandardSessionsManagerView } from "@/components/sales-coach/StandardSessionsManagerView";

/**
 * Sales Coach → Sessions (Phase 1). The full, filterable session history.
 * Staff see their own; managers see the company's with which agent ran each
 * — coaching visibility, chronological, NEVER ranked (§A18). Rows jump into
 * the existing session detail (§A21 — reuses it). Existing data only.
 * §3.4 — honest empty / degraded states.
 */

type Row = {
  id: string;
  clientLabel: string | null;
  context: "in_person" | "video";
  status: "active" | "ended" | "reviewed";
  startedAt: string;
  endedAt: string | null;
  territory: string | null;
  offer: string | null;
  outcome: string | null;
  agentName: string | null;
  hasDissect: boolean;
  hasSummary: boolean;
  hasReview: boolean;
  /** Interaction flag (founder 2026-07-09): "Needs Examination" (manager-only) or
   *  "Outstanding" (everyone). Null when the interaction was neutral or unanalyzed. */
  flag: SessionFlag | null;
};


// Coaching-insight data moved here from Home (founder 2026-07-04): the
// reliance trend, cross-session patterns, growth opportunities, and the
// session-pipeline counts now live on Sessions above the history list.
type ProgressPoint = { sessionId: string; startedAt: string; cueCount: number };
type Stats = {
  sessionsTotal: number;
  sessionsThisWeek: number;
  activeCount: number;
  awaitingReview: number;
  reviewedCount: number;
  cuesTotal: number;
  reviewsGenerated: number;
  recentGrowth: string[];
};
type WhyPatternSet = {
  hasEnoughData: boolean;
  whysAnalyzed: number;
  patterns: {
    pattern: string;
    frequency: string;
    outcomeAssociation: string;
    kind: "strength" | "growth";
  }[];
  note: string;
  failed: boolean;
};

function duration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const min = Math.round(ms / 60000);
  return min < 1 ? "<1m" : `${min}m`;
}

export default function SalesCoachSessionsPage() {
  // Spec p2 (founder-confirmed 2026-07-15): the Sessions tab is browse-only in
  // Standard — growth opportunities, where-sessions-stand, search, history. The
  // "Start a coaching session" card is removed here; starting a session lives on
  // Home. Expert keeps the start panel on this tab, unchanged.
  const { isStandard } = useExperienceMode();
  const [sessions, setSessions] = useState<Row[] | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  // F3: a permission/auth error is NOT transient — shown distinctly.
  const [noAccess, setNoAccess] = useState(false);
  // F1: when the badge query failed, we don't claim "no dissect" — we say
  // the review/dissect status is unavailable.
  const [badgesAvailable, setBadgesAvailable] = useState(true);

  // The flag whose detailed explanation is open (null = closed). Carries the
  // session's id (to open it) + label + agent so the modal names which call it's about.
  const [openFlag, setOpenFlag] = useState<{
    id: string;
    clientLabel: string | null;
    agentName: string | null;
    flag: SessionFlag;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [context, setContext] = useState<"all" | "in_person" | "video">("all");
  const [status, setStatus] = useState<
    "all" | "active" | "ended" | "reviewed"
  >("all");
  const [period, setPeriod] = useState<"all" | "30d" | "7d">("all");

  const load = useCallback(async () => {
    setLoading(true);
    // Server-side filters (backlog): context/status/period go to the DB query
    // so filtering isn't trapped inside the 300-row cap. Text search stays
    // client-side (matches client + agent name) — see `filtered`.
    const qs = new URLSearchParams();
    if (context !== "all") qs.set("context", context);
    if (status !== "all") qs.set("status", status);
    if (period !== "all") qs.set("period", period);
    try {
      const res = await fetch(
        `/api/coach/sales-session/list?${qs.toString()}`
      ).catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) setDegraded(true);
        else {
          setDegraded(false);
          setSessions(d.sessions ?? []);
          setIsManager(!!d.isManager);
          setBadgesAvailable(d.badgesAvailable !== false);
        }
      } else if (res && (res.status === 401 || res.status === 403)) {
        // Permission/auth — retrying won't help (§3.4: not "transient").
        setNoAccess(true);
      } else {
        setDegraded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [context, status, period]);

  useEffect(() => {
    void load();
  }, [load]);

  // context/status/period are applied SERVER-SIDE now (see load). Only the
  // text search (client + agent name) remains a client-side refinement.
  const filtered = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${s.clientLabel ?? ""} ${s.agentName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, search]);

  const anyFilter =
    search.trim() !== "" ||
    context !== "all" ||
    status !== "all" ||
    period !== "all";

  // --- Coaching insights (moved from Home 2026-07-04). Fetched separately
  // from the filter-driven list so filtering never re-hits these endpoints.
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  const [patternsState, setPatternsState] = useState<{
    stored: WhyPatternSet | null;
    whysAvailable: number;
    gateMet: boolean;
    stale: boolean;
  } | null>(null);
  const [patternsBusy, setPatternsBusy] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [dRes, pRes] = await Promise.all([
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
        fetch("/api/coach/sales-session/why-patterns").catch(() => null),
      ]);
      if (!alive) return;
      if (dRes && dRes.ok) {
        const d = await dRes.json();
        setStats(d.stats ?? null);
        setSeries(d.series ?? []);
      }
      if (pRes && pRes.ok) setPatternsState(await pRes.json());
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshPatterns = async () => {
    setPatternsBusy(true);
    setPatternsError(null);
    try {
      const res = await fetch("/api/coach/sales-session/why-patterns", {
        method: "POST",
      });
      if (!res.ok) {
        setPatternsError(`Couldn't build your patterns (HTTP ${res.status}).`);
        return;
      }
      const d = await res.json();
      const p = d.patterns as WhyPatternSet | undefined;
      if (p?.failed) {
        setPatternsError("Couldn't build your patterns right now — try again.");
      } else if (p?.hasEnoughData) {
        setPatternsState({
          stored: p,
          whysAvailable: p.whysAnalyzed,
          gateMet: true,
          stale: false,
        });
      }
    } catch {
      setPatternsError("Couldn't build your patterns.");
    } finally {
      setPatternsBusy(false);
    }
  };

  const trend = (() => {
    if (series.length < 3) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last) return null;
    return {
      first: first.cueCount,
      last: last.cueCount,
      down: last.cueCount < first.cueCount,
    };
  })();

  // ELOSALES revision (PDF Sessions item 1a): in Standard, a MANAGER's Sessions tab is the team roster →
  // rep's recent recordings. Early-return ONLY for standard managers — Expert (!isStandard) and standard REPS
  // (who keep their own browse-only self-view below, A10) never reach here, so those paths are byte-identical.
  //
  // FLICKER GATE (A28 — the precedent decides this, it was never a preference to flag). `isManager` starts
  // false and is only known once the list fetch resolves, so without this a Standard MANAGER renders the REP's
  // Sessions page first and then swaps to the roster. This codebase already ruled on that class: the F1
  // experience-mode flicker was fixed by making the first render the correct one (dashboard/layout.tsx →
  // initialMode; ExperienceModeProvider "start from the server-read mode ... no flicker window"). The principle
  // is what transfers — never render the wrong view while the deciding value is unknown — so in Standard we
  // hold both branches until the role is known rather than guessing rep and correcting. Expert (!isStandard) is
  // untouched by this gate and still renders exactly as before, including during load.
  if (isStandard && loading) {
    return (
      <>
        <TopBar title="Sessions" subtitle="Your coaching history" />
        <div className="flex-1 flex items-center justify-center bg-base">
          <span className="text-xs text-muted">Loading…</span>
        </div>
      </>
    );
  }
  if (isStandard && isManager) {
    return (
      <>
        <TopBar title="Sessions" subtitle="Your team" />
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-4 bg-base">
          <StandardSessionsManagerView fallback={null} />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Sessions" subtitle="Your coaching history" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-4 bg-base">
        {/* Start a session — Expert only. Spec p2: Standard's Sessions tab is
            browse-only (start lives on Home); Expert keeps the front door here. */}
        {!isStandard && <StartSessionPanel />}
        {/* ── Coaching insights (moved from Home 2026-07-04) ──────────── */}
        {/* Cue reliance — the training wheels (§3.5). Desktop-only; removed
            from the mobile app per founder 2026-07-04 (§2, mobile scope). */}
        <div className="hidden md:block">
        <LearningHint
          as="block"
          category="Sales Coach · Reliance"
          title="Your reliance on live cues"
          whatItIs="The trend of how many live cues you needed per session over time, with a sparkline of your recent sessions."
          why="This is the training-wheels gauge. The coach isn't meant to whisper forever — it's meant to make the moves yours. A falling line is the real win; a flat, high line means the skill hasn't transferred yet."
          how="Watch the direction, not a single session. If it's climbing, the reviews aren't sticking — pick one growth opportunity and drill it before your next call."
          principle="The coach is succeeding when you need it less."
        >
        <DeckCard className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-brand" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Your reliance on live cues
              </h2>
            </div>
            {series.length > 1 && (
              <span className="text-brand">
                <Sparkline data={series.map((p) => p.cueCount)} />
              </span>
            )}
          </div>
          {trend ? (
            <p className="text-xs text-secondary leading-relaxed">
              Across your sessions, live cues went from{" "}
              <span className="text-primary font-semibold">{trend.first}</span>{" "}
              to{" "}
              <span className="text-primary font-semibold">{trend.last}</span>{" "}
              per session.{" "}
              {trend.down
                ? "You're needing fewer cues over time — the training wheels are coming off."
                : "Keep going — the goal is fewer cues over time as the moves become yours."}
            </p>
          ) : (
            <p className="text-xs text-muted leading-relaxed">
              Not enough completed sessions yet to show a trend. After a few,
              you&apos;ll see whether you&apos;re needing fewer live cues over
              time — against your own past, never anyone else&apos;s.
            </p>
          )}
        </DeckCard>
        </LearningHint>
        </div>

        {/* What the coach is learning about you (§3.6; §4 — gated).
            Desktop-only; removed from the mobile app (founder 2026-07-04). */}
        {patternsState && (
          <div className="hidden md:block">
          <DeckCard className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  What your coach is learning about you
                </h2>
              </div>
              {(patternsState.stored || patternsState.gateMet) && (
                <LearningHint
                  as="inline-block"
                  category="Sales Coach · Learning"
                  title="What your coach is learning about you"
                  whatItIs="Builds (or refreshes) the cross-session patterns the coach sees across your calls — what's working for you and what's costing you, each tied to your recorded outcomes and your own reads."
                  why="One call is noise; patterns across many are signal. This is where the coach proves it's learning YOU, not repeating generic advice. It's gated — it won't invent patterns before there's enough real data."
                  how="Click to build it, or Refresh after new sessions. Treat each pattern as a hypothesis to test on your next doors, not a verdict."
                  principle="A coach that can't show what it's learned about you hasn't learned anything."
                >
                  <DeckGhostButton
                    pending={patternsBusy}
                    onClick={() => void refreshPatterns()}
                    active={patternsState.stale || !patternsState.stored}
                    icon={<Brain className="w-3 h-3" aria-hidden />}
                    className="!px-2.5 !py-1 !text-[11px]"
                  >
                    {patternsState.stored ? "Refresh" : "See what I'm learning"}
                  </DeckGhostButton>
                </LearningHint>
              )}
            </div>

            {patternsError && (
              <p className="text-[11px] text-amber-300 mb-2">{patternsError}</p>
            )}

            {patternsState.stored && patternsState.stored.patterns.length > 0 ? (
              <div className="space-y-3">
                {patternsState.stored.note && (
                  <p className="text-xs text-secondary leading-relaxed">
                    {patternsState.stored.note}
                  </p>
                )}
                {patternsState.stale && (
                  <p className="text-[10px] text-brand/80">
                    New sessions since this was built — refresh to update.
                  </p>
                )}
                <ul className="space-y-2">
                  {patternsState.stored.patterns.map((p, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[9px] uppercase tracking-widest font-bold ${
                            p.kind === "strength"
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }`}
                        >
                          {p.kind === "strength" ? "Working for you" : "Costing you"}
                        </span>
                        <span className="text-[10px] text-muted">{p.frequency}</span>
                      </div>
                      <p className="text-xs text-primary leading-relaxed">
                        {p.pattern}
                      </p>
                      <p className="text-[11px] text-secondary leading-relaxed mt-0.5">
                        {p.outcomeAssociation}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted">
                  Patterns from your own reads across{" "}
                  {patternsState.stored.whysAnalyzed} sessions — tied to what
                  actually happened, not guesses. For your growth, never a ranking.
                </p>
              </div>
            ) : patternsState.gateMet ? (
              <p className="text-xs text-secondary leading-relaxed">
                You&apos;ve got enough sessions now — build the patterns your
                coach is seeing across them.
              </p>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                Keep going — the coach needs a few more sessions with recorded
                outcomes and your own reads before real patterns can be trusted
                (not guessed).
              </p>
            )}
          </DeckCard>
          </div>
        )}

        {/* Growth opportunities to practice (§3.6 — visible, specific).
            Collapsed by default on the mobile app (founder 2026-07-04).
            REMOVED in Standard (founder spec ③, Elo Sales Edits.pdf p.2): the phone
            Sessions tab should show "only the sessions" — this block still rendered
            (collapsed) on the Standard rep's phone; gated off now. Expert unchanged. */}
        {!isStandard && stats && stats.recentGrowth.length > 0 && (
          <MobileCollapsibleSection
            icon={Lightbulb}
            label="Growth opportunities to practice"
          >
            <LearningHint
              as="block"
              category="Sales Coach · Growth"
              title="Growth opportunities to practice"
              whatItIs="Specific, practiceable next steps the coach has pulled from your recent reviews — the concrete fixes waiting to be worked on."
              why="Vague feedback doesn't change behavior; a concrete next step does. This is the actionable residue of your reviews — the difference between 'noted' and 'improved'."
              how="Pick ONE and take it into your next door. Don't try to fix them all at once — behavior changes one focus at a time."
              principle="One fix, practiced, beats twelve noted and forgotten."
            >
              <DeckCard className="divide-y divide-white/[0.06] overflow-hidden">
                {stats.recentGrowth.map((g, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                    <p className="text-xs text-secondary leading-relaxed">{g}</p>
                  </div>
                ))}
              </DeckCard>
            </LearningHint>
          </MobileCollapsibleSection>
        )}

        {/* Where your sessions stand — pipeline counts. Collapsed by default
            on the mobile app (founder 2026-07-04). */}
        {/* REMOVED in Standard (founder spec ③): "where your sessions stand" showed
            collapsed on the Standard rep's phone Sessions tab; spec wants only the
            sessions list + search. Gated off; Expert keeps it. */}
        {!isStandard && stats && (
          <MobileCollapsibleSection icon={Mic} label="Where your sessions stand">
            <div className="grid grid-cols-3 gap-2.5">
              <LearningHint
                as="block"
                category="Sales Coach · Pipeline"
                title="In progress"
                whatItIs="Sessions that are live right now — started and not yet ended."
                why="A session left 'in progress' is a call whose lesson is frozen — it can't be reviewed until it ends. A pile of these means calls are started but never closed out."
                how="End a session when the call is done so it can move to review. If this stays above zero, someone forgot to hit Stop."
                principle="A call that never ends never becomes a lesson."
              >
                <DeckStat icon={Mic} label="In progress" value={stats.activeCount} sub="Live now" tone="brand" />
              </LearningHint>
              <LearningHint
                as="block"
                category="Sales Coach · Pipeline"
                title="Awaiting review"
                whatItIs="Sessions that have ended but don't have a growth review yet."
                why="This is your backlog of un-pulled lessons — calls you already had but haven't learned from. The transcript's there; the growth isn't."
                how="Open each and generate its review. Keep this number low — the value is in the review, not the recording."
                principle="An un-reviewed call is potential, not progress."
              >
                <DeckStat icon={ArrowRight} label="Awaiting" value={stats.awaitingReview} sub="Not reviewed" tone="amber" />
              </LearningHint>
              <LearningHint
                as="block"
                category="Sales Coach · Pipeline"
                title="Reviewed"
                whatItIs="Sessions that have a completed growth review."
                why="These are the calls you've actually learned from — the compounding stack. The ratio of reviewed to awaiting tells you whether the coaching loop is closing or leaking."
                how="Aim for reviewed to keep pace with sessions. A growing 'awaiting' next to a flat 'reviewed' means lessons are evaporating."
                principle="Reviewed is where the growth actually banked."
              >
                <DeckStat icon={CheckCircle2} label="Reviewed" value={stats.reviewedCount} sub="Done" tone="emerald" />
              </LearningHint>
            </div>
          </MobileCollapsibleSection>
        )}

        {/* Filter bar */}
        <DeckCard className="p-2.5 flex flex-wrap items-center gap-2">
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Search sessions"
            whatItIs={
              isManager
                ? "A text filter that narrows the list by client label or by the rep (agent) who ran the call."
                : "A text filter that narrows the list by the client label you gave each session."
            }
            why="History only helps if you can find the specific call you're trying to learn from. Without search, a rep with hundreds of sessions can't get back to the one conversation that went sideways — so the lesson stays buried."
            how="Type part of a client name to jump to that conversation. Managers can also type a rep's name to pull up everyone's calls with that person. This search refines within the sessions already loaded — it doesn't change the context/status/time filters."
            principle="You can't review what you can't find."
          >
            <div className="relative flex-1 min-w-[180px]">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
                aria-hidden
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isManager ? "Search client or agent…" : "Search client…"}
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
              />
            </div>
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Context filter"
            whatItIs="Filters sessions by where the conversation happened: in-person (a door or field visit) or video (a remote call)."
            why="The two contexts are coached differently — body language and doorstep timing matter in person; framing, screen presence, and pacing matter on video. Mixing them hides patterns that only show up within one context."
            how="Set it to In-person or Video when you want to study one channel at a time — for example, to see whether your close rate at the door differs from your close rate on calls. This filter runs on the server, so it searches your whole history, not just what's on screen."
            principle="Improvement is context-specific; compare like with like."
          >
            <Select
              value={context}
              onChange={(v) => setContext(v as typeof context)}
              options={[
                ["all", "All contexts"],
                ["in_person", "In-person"],
                ["video", "Video"],
              ]}
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Status filter"
            whatItIs="Filters by where a session sits in its lifecycle: Active (still running), Ended (finished, not yet reviewed), or Reviewed (the growth review has been generated)."
            why="Ended-but-not-Reviewed is the pile that quietly costs you. Those calls happened, the transcript exists, but the lesson was never pulled — the learning stalls there. Being able to isolate that pile makes the backlog visible instead of invisible."
            how="Filter to Ended to find the calls waiting on a review, then work them down. Filter to Reviewed to revisit calls you've already extracted lessons from."
            principle="An ended call with no review is time logged but growth left on the table."
          >
            <Select
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              options={[
                ["all", "All status"],
                ["active", "Active"],
                ["ended", "Ended"],
                ["reviewed", "Reviewed"],
              ]}
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Time period filter"
            whatItIs="Limits the list to sessions from the last 7 days, last 30 days, or all time."
            why="Recent calls are where a change you're working on actually shows up. Narrowing to a window lets you check 'is the thing I've been practicing this week showing up in this week's calls?' — instead of averaging today's effort against months of old habits."
            how="Use Last 7 days to check in on a change you're actively drilling; Last 30 days to see a slower trend; All time for the full record. It filters on the server, so counts reflect your true history for that window."
            principle="Measure the change against the window it happened in, not against your whole past."
          >
            <Select
              value={period}
              onChange={(v) => setPeriod(v as typeof period)}
              options={[
                ["all", "All time"],
                ["30d", "Last 30 days"],
                ["7d", "Last 7 days"],
              ]}
            />
          </LearningHint>
        </DeckCard>

        {/* Session history — desktop always; on the mobile app only once the
            agent searches or filters (founder 2026-07-04: list removed from
            the mobile app, search kept). §2 mobile scope. */}
        <div className={anyFilter ? "block" : "hidden md:block"}>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : noAccess ? (
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="No workspace access"
            whatItIs="An honest permission notice: your account isn't attached to a Sales Coach workspace, so there's no session history to show you here."
            why="This is deliberately shown as a distinct state, not an empty list. 'No access' and 'no sessions yet' are different truths — collapsing them into a blank page would quietly mislead you into thinking you have no history when really you're just not connected to the right workspace."
            how="If you expected to see coaching sessions here, ask an admin to check that your account is linked to the correct Sales Coach workspace. Retrying won't fix a permissions gap."
            principle="An error dressed as an empty result is a lie the interface tells you."
          >
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
              <p className="text-xs text-secondary">
                You don&apos;t have access to a Sales Coach workspace here. Ask an
                admin if this looks wrong.
              </p>
            </div>
          </LearningHint>
        ) : degraded ? (
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Load failed (not empty)"
            whatItIs="An error state shown when the session list couldn't be fetched — separated on purpose from a genuinely empty history."
            why="If a failed load rendered as 'no sessions,' you'd think your calls vanished and stop trusting the record. The coach's whole value rests on an intact history, so a transient failure must announce itself as a failure — never masquerade as zero sessions."
            how="Wait a moment and reload. If it keeps failing, that's a real outage to report — not a sign your sessions are gone."
            principle="When the data can't load, say so — don't render silence as absence."
          >
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
              <p className="text-xs text-amber-300">
                Couldn&apos;t load your sessions right now — this is an error, not
                an empty history. Try again shortly.
              </p>
            </div>
          </LearningHint>
        ) : filtered.length === 0 ? (
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Empty result"
            whatItIs="A true empty state — either you haven't recorded any sessions yet, or none of your sessions match the filters currently applied."
            why="The message distinguishes 'nothing exists yet' from 'nothing matches these filters,' because the fix is different: one means go start a call, the other means loosen your filters. A single vague 'nothing here' would leave you guessing which."
            how="If you have no sessions at all, start one from Home to begin building history. If you know sessions exist, clear or widen the filters above to bring them back."
            principle="Empty because you filtered it out is not the same as empty because it isn't there."
          >
            <p className="text-xs text-muted py-12 text-center">
              {(sessions ?? []).length === 0
                ? "No sessions yet. Start one from Home."
                : "No sessions match these filters."}
            </p>
          </LearningHint>
        ) : (
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="A session row"
            whatItIs="Each row is one recorded conversation. Left to right: a context icon (a video screen for remote calls, a map pin for in-person), the client label, then a detail line with the date, call length, lifecycle status, territory, and — for managers — which rep ran it. On the right sit the outcome and the artifact badges. Clicking a row opens the full session detail."
            why="This is your conversation history laid out so patterns surface — chronological, never ranked. Rank a rep against a leaderboard and they perform for the number; list calls plainly and the record stays honest enough to actually learn from. The row is a door back into a specific call, which is where real review happens."
            how="Scan the detail line to spot patterns — a string of short in-person calls, a run of the same outcome. Click any row to reopen that conversation and study what happened turn by turn. Managers: the rep's name is here for coaching that call, not for stacking people against each other."
            principle="A visible, chronological record teaches; a ranked one just makes people perform."
          >
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm divide-y divide-default overflow-hidden">
              {filtered.map((s) => (
                // The row is a flex container; only the LEFT content is the
                // navigating <Link>. The flag is an interactive <button> and MUST
                // NOT be nested inside an <a> (invalid HTML — interactive-in-
                // interactive breaks keyboard + screen-reader behavior), so it sits
                // as a sibling of the Link, not a child.
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <Link
                    href={`/dashboard/sales-coach/${s.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <LinkProgress />
                    <span className="shrink-0 text-muted">
                      {s.context === "video" ? (
                        <Video className="w-4 h-4" aria-hidden />
                      ) : (
                        <MapPin className="w-4 h-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-primary truncate">
                        {s.clientLabel ?? "Untitled session"}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {new Date(s.startedAt).toLocaleString()} ·{" "}
                        {duration(s.startedAt, s.endedAt)} · {s.status}
                        {s.territory ? ` · ${s.territory}` : ""}
                        {isManager && s.agentName ? ` · ${s.agentName}` : ""}
                      </span>
                    </span>
                  </Link>
                  {s.flag && (
                    <FlagBadge
                      flag={s.flag}
                      onOpen={() =>
                        setOpenFlag({
                          id: s.id,
                          clientLabel: s.clientLabel,
                          agentName: s.agentName,
                          flag: s.flag!,
                        })
                      }
                    />
                  )}
                  {s.outcome && (
                    <span className="shrink-0">
                      <DeckPill>{outcomeLabel(s.outcome)}</DeckPill>
                    </span>
                  )}
                  {badgesAvailable && (
                    <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                      {s.hasReview && <Badge icon={Star} label="Review" />}
                      {s.hasDissect && <Badge icon={Sparkles} label="Dissect" />}
                      {s.hasSummary && <Badge icon={FileText} label="Summary" />}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </LearningHint>
        )}
        </div>
        {/* Mobile idle hint — the list is removed on the mobile app, but the
            search is kept; results appear once the agent searches or filters. */}
        {!anyFilter && (
          <p className="md:hidden text-xs text-muted py-8 text-center">
            Search above to find a past session.
          </p>
        )}

        {/* F1: don't claim "no dissect" when the badge query failed. */}
        {!loading && !noAccess && !degraded && !badgesAvailable && (
          <p className="text-[10px] text-amber-300/80 text-center">
            Review / dissect status is unavailable right now.
          </p>
        )}

        {/* F4: the cap is real — say so, and that filtering happens WITHIN it. */}
        {!loading && !noAccess && !degraded && (sessions ?? []).length >= 300 && (
          <p className="text-[10px] text-muted text-center">
            {anyFilter
              ? "Filtered on the server — up to the 300 most recent matches (text search refines within them)."
              : "Showing the 300 most recent sessions."}
          </p>
        )}

        {/* F2 (§A10): disclose upward visibility to the agent (not to managers,
            who are the coach). */}
        {!loading && !noAccess && !degraded && !isManager && (
          <p className="text-[10px] text-muted text-center">
            Your coach can see your sessions — for coaching, not ranking.
          </p>
        )}
      </div>
      {openFlag && (
        <Modal
          open
          onClose={() => setOpenFlag(null)}
          title={
            openFlag.flag.kind === "examination"
              ? "Needs Manager/Admin Examination"
              : "Outstanding Performance Review"
          }
          size="md"
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              {openFlag.flag.kind === "examination" ? (
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden />
              ) : (
                <Award className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden />
              )}
              <p className="text-sm text-primary leading-relaxed">
                {openFlag.flag.headline}
              </p>
            </div>
            <p className="text-[11px] text-muted">
              {openFlag.clientLabel ?? "Untitled session"}
              {openFlag.agentName ? ` · ${openFlag.agentName}` : ""}
            </p>
            <ul className="space-y-2">
              {openFlag.flag.reasons.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <p className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-0.5">
                    {r.label}
                  </p>
                  <p className="text-xs text-primary leading-relaxed">{r.detail}</p>
                </li>
              ))}
            </ul>
            {/* §A18/§3.4 honesty: name what the explanation is built from, and that
                it is NOT the rep's private scores (which managers can't see). Names
                ALL the bases the classifier actually uses — the outcome (the primary
                basis for most flags since the v2 broadening), the pivot, the prospect's
                sentiment, and any breakdown moment — so the note isn't accurate only
                for the pivot/sentiment case (§3.4: the disclosure must match the basis). */}
            <p className="text-[10px] text-muted leading-relaxed">
              Composed from this call&apos;s recorded signals — its outcome, the pivot
              moment, the prospect&apos;s sentiment across the conversation, and any
              breakdown point. It does not use the rep&apos;s private after-pitch scores.
            </p>
            {/* AMD-006 Layer 3 (workflow continuity): after reading WHY, the manager's
                next action is to examine the call — link straight into it, not a
                dead-end that forces close → find row → click. */}
            <div className="flex justify-end pt-1">
              <Link
                href={`/dashboard/sales-coach/${openFlag.id}`}
                onClick={() => setOpenFlag(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {openFlag.flag.kind === "examination"
                  ? "Open this session to examine"
                  : "Open this session to review"}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * FlagBadge — the clickable interaction flag on a session row (founder
 * 2026-07-09). Amber "Needs Examination" (manager-only; the route already
 * suppresses it for non-managers) or emerald "Outstanding". Rendered as a SIBLING
 * of the row's <Link> (not nested inside it — a button inside an anchor is invalid
 * HTML), so a plain onClick opens the explanation without any navigation to cancel.
 */
function FlagBadge({
  flag,
  onOpen,
}: {
  flag: NonNullable<SessionFlag>;
  onOpen: () => void;
}) {
  const isExam = flag.kind === "examination";
  const Icon = isExam ? AlertTriangle : Award;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors ${
        isExam
          ? "text-amber-300 border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20"
          : "text-emerald-300 border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20"
      }`}
      title="Click for the detailed explanation"
      aria-label={
        isExam
          ? "Needs manager examination — open the detailed explanation"
          : "Outstanding performance — open the detailed explanation"
      }
    >
      <Icon className="w-2.5 h-2.5" aria-hidden />
      {isExam ? "Needs Examination" : "Outstanding"}
    </button>
  );
}

/**
 * MobileCollapsibleSection — on the mobile app the section starts collapsed
 * and the agent taps to expand; on desktop it's always open (the toggle is
 * md:hidden and the body is md:block). Founder 2026-07-04: "make it collapse
 * by default, sales agent can click to expand" — mobile only, desktop
 * unchanged (§2 mobile scope; §A18 the affordance invites the expand action).
 */
function MobileCollapsibleSection({
  icon,
  label,
  children,
}: {
  icon: typeof Mic;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel icon={icon}>{label}</SectionLabel>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="md:hidden inline-flex items-center gap-1 text-[11px] text-muted hover:text-secondary transition-colors shrink-0"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      <div className={`${open ? "block" : "hidden"} md:block mt-2`}>
        {children}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-black/30 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-secondary focus:outline-none focus:border-ember-400/50"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof Star; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-secondary border border-default rounded-full px-2 py-0.5">
      <Icon className="w-2.5 h-2.5" aria-hidden />
      {label}
    </span>
  );
}
