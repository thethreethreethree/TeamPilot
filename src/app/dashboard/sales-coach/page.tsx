"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Mic,
  Video,
  DoorOpen,
  TrendingDown,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  Brain,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import {
  DeckShell,
  DeckCard,
  DeckStat,
  DeckButton,
  DeckGhostButton,
  SectionLabel,
  DeckPill,
  Sparkline,
} from "@/components/sales-coach/ui/deck";
import { LinkProgress } from "@/components/sales-coach/ui/NavigationProgress";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /dashboard/sales-coach — Sales Coach product home.
 *
 * Modeled on the C.A.R.E home (§3.6 make-learning-visible), re-centered
 * on sales coaching: this surface shows what the coach helped with this
 * week and whether the agent is growing — measured against their OWN
 * past, never ranked against others (§A18 digital-gym). Every number is
 * real (§3.4); the empty state is the honest truth, not a placeholder.
 */

type Session = {
  id: string;
  context: "in_person" | "video";
  clientLabel: string | null;
  status: "active" | "ended" | "reviewed";
  startedAt: string;
};
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

export default function SalesCoachHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<ProgressPoint[]>([]);
  // Phase 4 — cross-session why patterns (§3.6). F1: served from a STORED set
  // (no LLM on load); regenerated only on an explicit refresh (POST).
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
  const [patternsState, setPatternsState] = useState<{
    stored: WhyPatternSet | null;
    whysAvailable: number;
    gateMet: boolean;
    stale: boolean;
  } | null>(null);
  const [patternsBusy, setPatternsBusy] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);
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
  const [context, setContext] = useState<"in_person" | "video">("video");
  const [clientLabel, setClientLabel] = useState("");
  // Phase 2 capture (optional) — WHERE / HOW / WHAT, entered up front.
  const [territory, setTerritory] = useState("");
  const [approach, setApproach] = useState("");
  const [offer, setOffer] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, dRes, pRes] = await Promise.all([
        fetch("/api/coach/sales-session").catch(() => null),
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
        fetch("/api/coach/sales-session/why-patterns").catch(() => null),
      ]);
      if (sRes && sRes.ok) setSessions((await sRes.json()).sessions ?? []);
      else setSessions([]);
      if (dRes && dRes.ok) {
        const d = await dRes.json();
        setStats(d.stats ?? null);
        setSeries(d.series ?? []);
      }
      if (pRes && pRes.ok) setPatternsState(await pRes.json());
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    // Every session must be titled before it can begin (founder 2026-07-01):
    // an untitled session creates initial ambiguity in the history.
    const label = clientLabel.trim();
    if (!label) {
      setError("Give the session a client / campaign title before starting.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          clientLabel: label,
          territory: territory.trim() || undefined,
          approach: approach.trim() || undefined,
          offer: offer.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `Couldn't start (HTTP ${res.status})`);
      }
      const { session } = await res.json();
      router.push(`/dashboard/sales-coach/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  // Cue-reliance trend — honest about sparsity (§3.4): a trend needs ≥3
  // ended sessions; below that we say so rather than imply progress.
  const trend = (() => {
    if (series.length < 3) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last) return null;
    return { first: first.cueCount, last: last.cueCount, down: last.cueCount < first.cueCount };
  })();

  return (
    <>
      <TopBar title="Sales Coach" subtitle="Your coaching, made visible" />
      <DeckShell>
        {/* §3.6 + §A18 reframe — this is a digital gym, not a scorecard. */}
        <LearningHint
          as="block"
          category="Sales Coach · Philosophy"
          title="Made visible, not ranked"
          whatItIs="The framing for this whole surface: it shows your selling made visible — what the coach helped with and whether you lean on fewer cues over time — measured against your OWN past."
          why="A coaching tool becomes surveillance the moment it's used to rank people. This reframe is deliberate: everything here is for growth against yourself, never a leaderboard. The label is what decides whether the data helps or punishes."
          how="Read every number here as a trend against your own history, not against a teammate. If you're a manager, use it to coach a person up — never to compare people."
          principle="Visibility serves growth, or it becomes surveillance — the framing decides which."
        >
          <DeckCard glow className="p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-[11px] text-secondary leading-relaxed">
              This isn&apos;t a scorecard or a ranking. It&apos;s your selling,
              made visible — what the coach helped with and whether you&apos;re
              needing fewer cues over time, measured against your{" "}
              <span className="text-primary">own</span> past.
            </p>
          </DeckCard>
        </LearningHint>

        {/* Start a session */}
        <DeckCard className="p-4">
          <h2 className="text-sm font-semibold text-primary mb-3">
            Start a coaching session
          </h2>
          <LearningHint
            as="block"
            category="Sales Coach · Session"
            title="In-person vs. video"
            whatItIs="Whether this session is an in-person conversation (a door, a field visit) or a remote video call."
            why="The coach adapts to the channel — doorstep timing and body language in person; framing and pacing on video. Set right, the cues and the review fit how the conversation actually happens."
            how="Pick the one that matches this call before you start. It's also what lets you later compare your in-person close rate against your video close rate."
            principle="Coach the channel you're actually in."
          >
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <DeckGhostButton
                active={context === "video"}
                onClick={() => setContext("video")}
              >
                <Video className="w-3.5 h-3.5" aria-hidden />
                Online video
              </DeckGhostButton>
              <DeckGhostButton
                active={context === "in_person"}
                onClick={() => setContext("in_person")}
              >
                <DoorOpen className="w-3.5 h-3.5" aria-hidden />
                In-person
              </DeckGhostButton>
            </div>
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Session"
            title="Client / campaign label"
            whatItIs="A short label for who or what this session is about — a client name, a campaign, or a door number."
            why="It's how you find this exact conversation later to learn from it. A pile of untitled sessions is a history you can't navigate."
            how="Give it something you'll recognize ('Door 17', 'Acme renewal'). It's required — the session won't start without it. A trailing number auto-increments when you use 'Start Next Door'."
            principle="A conversation you can't find later is a lesson you can't revisit."
          >
            <input
              type="text"
              value={clientLabel}
              onChange={(e) => setClientLabel(e.target.value)}
              placeholder="Client / campaign (required)"
              className="w-full text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 mb-2.5"
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Session"
            title="Start session"
            whatItIs="Begins a coaching session and opens its page, where you run live coaching or upload a recording, then review it."
            why="This is the front door of the whole loop — capture → coach → review → next door. No session, no coaching."
            how="Add a client label, then start. You'll land on the session page to begin live coaching or attach a recording."
            principle="The coaching only compounds if you actually start the door."
          >
            <DeckButton
              pending={starting}
              onClick={() => void start()}
              disabled={!clientLabel.trim()}
              icon={<Mic className="w-4 h-4" aria-hidden />}
              className="w-full"
            >
              Start session
            </DeckButton>
          </LearningHint>
          {/* Phase 2 capture — optional WHERE/HOW/WHAT behind a toggle so it
              never blocks the primary title+start flow (L4). */}
          <LearningHint
            as="inline-block"
            category="Sales Coach · Session"
            title="Optional session details"
            whatItIs="An optional expander to capture WHERE (territory), HOW (approach), and WHAT (the offer) for this session, before the call."
            why="Not required, but they let the coach reason about context — tailoring prep to the offer, or letting you later see whether a referral approach outperforms a cold one. Kept optional so they never block starting."
            how="Expand it only when you want richer context; skip it entirely to start fast."
            principle="Context sharpens coaching — but never at the cost of just getting started."
          >
            <button
              type="button"
              onClick={() => setShowCapture((v) => !v)}
              className="mt-3 text-[11px] text-muted hover:text-secondary transition-colors"
            >
              {showCapture ? "− Hide details" : "+ Add details (where / how / what) — optional"}
            </button>
          </LearningHint>
          {showCapture && (
            <div className="mt-2 grid grid-cols-1 gap-2">
              <CaptureInput
                value={territory}
                onChange={setTerritory}
                placeholder="Where (territory / area)"
              />
              <CaptureInput
                value={approach}
                onChange={setApproach}
                placeholder="How (referral / cold / follow-up)"
              />
              <CaptureInput
                value={offer}
                onChange={setOffer}
                placeholder="What (the offer pitched)"
              />
            </div>
          )}
          {error && <p className="text-xs text-amber-300 mt-2">{error}</p>}
        </DeckCard>

        {/* What compounded this week */}
        <SectionLabel icon={Sparkles}>What your coach helped with</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <LearningHint
            as="block"
            category="Sales Coach · Activity"
            title="Sessions this week"
            whatItIs="How many coaching sessions you've run this week, with your all-time total underneath."
            why="A coaching habit compounds door by door. This is your activity pulse — not a quota, but a signal of whether the coach is actually being used. A week at zero is a coach going to waste."
            how="Aim for a steady rhythm rather than a burst. Watch for weeks that drop to zero — that's the coach going unused, not a break earned."
            principle="Skill is built between doors, not in one heroic session."
          >
            <DeckStat
              icon={GraduationCap}
              label="Sessions / week"
              value={stats?.sessionsThisWeek ?? 0}
              sub={`${stats?.sessionsTotal ?? 0} total`}
              tone="brand"
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Learning"
            title="Growth reviews"
            whatItIs="The number of post-call growth reviews the coach has generated from your conversations."
            why="The review is where learning actually happens — the honest read of what worked and the one thing to fix next. A session without a review is time logged but the lesson never pulled."
            how="Run a review after each call. If reviews lag far behind sessions, the transcripts exist but no one is extracting the growth."
            principle="A call you don't review is a call you can only repeat, not improve."
          >
            <DeckStat
              icon={Sparkles}
              label="Growth reviews"
              value={stats?.reviewsGenerated ?? 0}
              sub="From your calls"
              tone="emerald"
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Reliance"
            title="Live cues delivered"
            whatItIs="How many in-the-moment cues the coach has whispered during live calls, across all sessions."
            why="Cues help in the moment — but the goal is fewer over time. A high, flat count means reps still lean on the earpiece; a falling count means the moves are becoming their own."
            how="Watch the trend, not the raw number — pair it with the cue-reliance panel below to see whether reliance is actually dropping."
            principle="The coach succeeds when it's needed less, not more."
          >
            <DeckStat
              icon={MessageSquare}
              label="Live cues"
              value={stats?.cuesTotal ?? 0}
              sub="All sessions"
              tone="muted"
            />
          </LearningHint>
          <LearningHint
            as="block"
            category="Sales Coach · Growth"
            title="Growth opportunities"
            whatItIs="The count of specific, practiceable growth opportunities the coach has surfaced for you to work on."
            why="Vague feedback ('get better at closing') doesn't change behavior; one concrete next step does. This is the pile of concrete fixes waiting to be practiced."
            how="Pick one and take it into your next door. Don't try to fix twelve things at once — behavior changes one focus at a time."
            principle="One fix, practiced, beats twelve noted and forgotten."
          >
            <DeckStat
              icon={Lightbulb}
              label="Growth ops"
              value={stats?.recentGrowth.length ?? 0}
              sub="To practice"
              tone="amber"
            />
          </LearningHint>
        </div>

        {/* Cue reliance — the training wheels (§3.5) */}
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

        {/* Phase 4 — what the coach is learning about you across sessions
            (§3.6 make-learning-visible; §4 — gated). Served from a STORED set;
            the LLM runs only on an explicit refresh below. */}
        {patternsState && (
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
        )}

        {/* Growth opportunities to practice (§3.6 — visible, specific) */}
        {stats && stats.recentGrowth.length > 0 && (
          <>
            <SectionLabel icon={Lightbulb}>
              Growth opportunities to practice
            </SectionLabel>
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
          </>
        )}

        {/* Current load */}
        {stats && (
          <>
            <SectionLabel icon={Mic}>Where your sessions stand</SectionLabel>
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
          </>
        )}

        {/* Sessions */}
        <SectionLabel icon={ArrowRight}>Your sessions</SectionLabel>
        {sessions === null ? (
          <div className="flex items-center gap-2 text-xs text-muted py-8 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : sessions.length === 0 ? (
          <DeckCard className="p-6">
            <p className="text-xs text-muted text-center">
              No sessions yet. Start one above.
            </p>
          </DeckCard>
        ) : (
          <LearningHint
            as="block"
            category="Sales Coach · Sessions"
            title="Your sessions"
            whatItIs="Your recent coaching sessions — each row shows the context (video / in-person), the client label, when it started, and its status (active / ended / reviewed)."
            why="This is your history — the calls you can return to and learn from. The status pill tells you at a glance which still need a review."
            how="Tap a row to open that session — run its review, read the transcript, or open the After Pitch summary. Chase down anything still 'ended' but not reviewed."
            principle="History only helps if you actually return to it."
          >
          <DeckCard className="divide-y divide-white/[0.06] overflow-hidden">
            {sessions.map((s) => {
              const tone =
                s.status === "reviewed"
                  ? "emerald"
                  : s.status === "active"
                    ? "brand"
                    : "amber";
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/sales-coach/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <LinkProgress />
                  <div className="flex items-center gap-2.5 min-w-0">
                    {s.context === "video" ? (
                      <Video className="w-4 h-4 text-muted shrink-0" aria-hidden />
                    ) : (
                      <DoorOpen className="w-4 h-4 text-muted shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        {s.clientLabel ?? "Untitled session"}
                      </p>
                      <p className="text-[10px] text-muted">
                        {new Date(s.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DeckPill tone={tone}>{s.status}</DeckPill>
                    <ArrowRight className="w-3.5 h-3.5 text-muted" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </DeckCard>
          </LearningHint>
        )}
      </DeckShell>
    </>
  );
}

function CaptureInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
    />
  );
}
