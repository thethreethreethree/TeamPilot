"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Video,
  DoorOpen,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Lightbulb,
  MessageSquare,
  Star,
  Bot,
  Target,
  Library,
  ArrowLeft,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import {
  DeckShell,
  DeckCard,
  DeckStat,
  DeckButton,
  DeckGhostButton,
  SectionLabel,
} from "@/components/sales-coach/ui/deck";
import { LearningHint } from "@/components/learning/LearningHint";
import { ONE_LINERS_LABEL, ROLEPLAY_PRACTICE_LABEL } from "@/lib/coach/labels";

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
  // The rep's name for the mobile "Welcome, [name]" header (PWA home).
  const [name, setName] = useState<string | null>(null);
  const [context, setContext] = useState<"in_person" | "video">("video");
  // Spec 1a (2026-07-15): In-person is the default for Standard — door-to-door reps
  // live at doorsteps, not on video, and defaulting to the channel they never use is
  // a tiny tax paid on every single session. Expert keeps the prior video default,
  // unchanged. The effect flips the default once the mode resolves; deps are stable
  // after load, so a rep's manual pick afterward is never overridden.
  const { isStandard, loaded: modeLoaded } = useExperienceMode();
  useEffect(() => {
    if (modeLoaded && isStandard) setContext("in_person");
  }, [modeLoaded, isStandard]);
  const [clientLabel, setClientLabel] = useState("");
  // Phase 2 capture (optional) — WHERE / HOW / WHAT, entered up front.
  const [territory, setTerritory] = useState("");
  const [approach, setApproach] = useState("");
  const [offer, setOffer] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Home fetches the dashboard stats (desktop tiles + mobile PITCHES pill)
    // and the rep's name (mobile Welcome header). The reliance trend, patterns,
    // growth ops, pipeline counts + session list moved to Sessions (2026-07-04).
    try {
      const [dRes, idRes] = await Promise.all([
        fetch("/api/coach/sales-session/dashboard").catch(() => null),
        fetch("/api/me/identity").catch(() => null),
      ]);
      if (dRes && dRes.ok) {
        const d = await dRes.json();
        setStats(d.stats ?? null);
      }
      if (idRes && idRes.ok) {
        setName((await idRes.json()).fullName ?? null);
      }
    } catch {
      /* stats/name stay null — the tiles show 0, an honest empty (§3.4) */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    // Spec 1b: Standard no longer forces a title up front — a door-to-door rep
    // shouldn't have to name a call before it happens; they name it AFTER, once
    // they know what it was ("angry customer"). Empty in Standard → a neutral
    // placeholder they rename on the post-call screen. Expert still requires a
    // title (its history workflow leans on it), unchanged.
    const label = clientLabel.trim() || (isStandard ? "New session" : "");
    if (!label) {
      setError("Give the session a client / campaign title before starting.");
      return;
    }
    // Synchronous latch: `pending={starting}` disables the button only a render
    // after the click, so a double-click would POST two sessions. (Same fix as
    // StartSessionPanel + after-pitch startNextDoor — this is a THIRD start
    // handler, on the coach landing page, that the earlier sweep missed.)
    if (startingRef.current) return;
    startingRef.current = true;
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
      startingRef.current = false;
      setStarting(false);
    }
    // On success we router.push away and unmount, so the latch stays set.
  };

  return (
    <>
      {/* ── Mobile PWA home — the 2×2 launchpad (founder 2026-07-04) ─────── */}
      <div className="md:hidden flex-1 overflow-y-auto bg-base px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        {/* Exit back to the main ELOSTATE app. The desktop sidebar carries
            this at its footer, but that sidebar is hidden on mobile — so the
            mobile user had no way out (audit F1). Home is a bottom-tab, so
            surfacing it on the hub makes ELOSTATE reachable from any Sales
            Coach page in ≤2 taps. Mirrors C.A.R.E's "Back to ELOSTATE"
            (§1.5.1 layer-3 continuity; §A21 cross-product parity). */}
        <div className="flex justify-start">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 rounded-lg px-2 py-1 -ml-1 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Back to ELOSTATE
          </Link>
        </div>
        {/* Welcome */}
        <div className="text-center pt-1 pb-5">
          <h1 className="text-2xl font-bold text-brand inline-flex items-center gap-2">
            Welcome
            <Star className="w-5 h-5 fill-ember-400 text-ember-400" aria-hidden />
          </h1>
          <p className="text-2xl font-bold text-brand leading-tight">
            {name ?? "back"}
          </p>
        </div>

        {/* 2×2 feature grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard
            href="/dashboard/sales-coach/analytics"
            icon={Mic}
            title="Pitch Performance"
            sub="Analyze recent calls & feedback"
          />
          <MobileCard
            href="/dashboard/sales-coach/sessions"
            icon={Bot}
            title="Live AI Coach & Sessions"
            sub="Join live or start AI-coached sessions."
          />
          <MobileCard
            href="/dashboard/sales-coach/roleplay"
            icon={Target}
            title={ROLEPLAY_PRACTICE_LABEL}
            sub="Build your skills with simulated pitches"
          />
          <MobileCard
            href="/dashboard/sales-coach/strategy"
            icon={Library}
            // Founder 2026-08-01: "One Liners" is the universal name now (was a Standard-only relabel — the same
            // mode-specific miss that made the rename look like it "didn't stick" in Expert mode). Sourced from
            // the shared ONE_LINERS_LABEL constant so it can't drift from the nav + page title again.
            title={ONE_LINERS_LABEL}
            sub="Find your top-performing lines and sales strategies"
          />
        </div>

        {/* Stat pills — Pitches is real; Roleplays is honestly 0 until Roleplay
            Practice ships (§3.4). */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted font-bold">
              Pitches
            </span>
            <span className="text-lg font-bold text-primary">
              {stats?.sessionsTotal ?? 0}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted font-bold">
              Roleplays
            </span>
            <span className="text-lg font-bold text-primary">0</span>
          </div>
        </div>

        {/* Get the browser extension — coach the conversation you're viewing (founder request 2026-08-08).
            Hidden on mobile (founder 2026-08-11): the extension is a Chrome/desktop-only install, so promoting
            it on a phone is a dead end — a link the mobile user can't act on. `hidden sm:flex` shows it only at
            the ≥640px widths where installing it is possible. */}
        <Link
          href="/extension/download-sales"
          className="mt-3 hidden sm:flex items-center justify-between gap-2 rounded-xl border border-ember-400/30 bg-ember-400/[0.06] px-4 py-3 hover:bg-ember-400/[0.1] transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get the Sales Coach extension
          </span>
          <span className="text-[11px] text-muted">Install &amp; coach anywhere →</span>
        </Link>

        {/* Start CTA — reveals the existing capture form (a title is required
            before a session can begin, § our rule). */}
        <div className="mt-4">
          {!showCapture ? (
            <DeckButton
              icon={<Mic className="w-4 h-4" aria-hidden />}
              onClick={() => setShowCapture(true)}
              className="w-full"
            >
              Start Next Pitch Session
            </DeckButton>
          ) : (
            <div className="rounded-xl border border-ember-400/40 bg-white/[0.02] p-3 space-y-2.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContext("video")}
                  className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    context === "video"
                      ? "border-ember-400/50 bg-ember-400/10 text-brand"
                      : "border-default text-secondary"
                  }`}
                >
                  Online video
                </button>
                <button
                  type="button"
                  onClick={() => setContext("in_person")}
                  className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    context === "in_person"
                      ? "border-ember-400/50 bg-ember-400/10 text-brand"
                      : "border-default text-secondary"
                  }`}
                >
                  In-person
                </button>
              </div>
              {/* Standard: no name field here (founder 2026-07-26, image 4 "take
                  this out"). The pitch is named AFTER the call on the After-Pitch
                  screen, once the rep knows what it was. Expert still names up
                  front (required — Start is disabled without it). */}
              {!isStandard && (
                <CaptureInput
                  value={clientLabel}
                  onChange={setClientLabel}
                  placeholder="Client / campaign (required)"
                />
              )}
              {error && <p className="text-[11px] text-amber-300">{error}</p>}
              <DeckButton
                pending={starting}
                icon={<Mic className="w-4 h-4" aria-hidden />}
                onClick={() => void start()}
                className="w-full"
              >
                Start session
              </DeckButton>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop dashboard (unchanged) ───────────────────────────────── */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
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

        {/* Get the browser extension — coach the conversation you're viewing (founder request 2026-08-08).
            Hidden on mobile (founder 2026-08-11): the extension is a Chrome/desktop-only install, so it's a
            dead end on a phone. `hidden sm:block` shows it only at ≥640px widths where installing it works. */}
        <Link href="/extension/download-sales" className="hidden sm:block">
          <DeckCard className="p-3.5 flex items-center justify-between gap-2.5 hover:border-strong transition-colors">
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Get the Sales Coach browser extension
            </span>
            <span className="text-[11px] text-muted">Coach the conversation you&apos;re viewing →</span>
          </DeckCard>
        </Link>

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
          {/* Standard: no name field here (founder 2026-07-26, image 4) — Standard
              names the pitch AFTER the call on the After-Pitch screen. Expert keeps
              the required up-front label. */}
          {!isStandard && (
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
          )}
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
              disabled={!isStandard && !clientLabel.trim()}
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
      </div>
    </>
  );
}

/** A tappable feature card on the mobile PWA home (founder 2026-07-04). */
function MobileCard({
  href,
  icon: Icon,
  title,
  sub,
}: {
  href: string;
  icon: typeof Mic;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-ember-400/40 bg-white/[0.02] shadow-[0_0_30px_-16px_rgba(250,204,21,0.5)] p-3.5 flex flex-col items-center justify-center text-center gap-2 aspect-[3/3.4] active:scale-[0.98] transition-transform"
    >
      <Icon className="w-9 h-9 text-brand" strokeWidth={1.5} aria-hidden />
      <span className="text-sm font-bold text-primary leading-tight">
        {title}
      </span>
      <span className="text-[10px] text-muted leading-snug">{sub}</span>
    </Link>
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
