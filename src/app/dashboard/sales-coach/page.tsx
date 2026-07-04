"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Video,
  DoorOpen,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import {
  DeckShell,
  DeckCard,
  DeckStat,
  DeckButton,
  DeckGhostButton,
  SectionLabel,
} from "@/components/sales-coach/ui/deck";
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
  const [stats, setStats] = useState<Stats | null>(null);
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
    // Only the coach-helped stat tiles remain on Home; the reliance trend,
    // patterns, growth ops, pipeline counts + session list moved to Sessions
    // (founder 2026-07-04). So Home fetches just the dashboard stats now.
    try {
      const dRes = await fetch(
        "/api/coach/sales-session/dashboard"
      ).catch(() => null);
      if (dRes && dRes.ok) {
        const d = await dRes.json();
        setStats(d.stats ?? null);
      }
    } catch {
      /* stats stay null — the tiles show 0, an honest empty (§3.4) */
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
