"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Building2,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitMerge,
  Landmark,
  Lightbulb,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserMinus,
  Users,
  Zap,
} from "lucide-react";

/**
 * /pitch — ExecOS product presentation deck.
 *
 * Designed as a single, scrollable URL that doubles as a slide deck:
 *  - Each section is full-viewport (one "slide" per screen)
 *  - Arrow keys jump between slides; PageUp/PageDown also work
 *  - "S" key toggles a small slide counter
 *  - Scrolls naturally on any device
 *
 * Audience: anyone evaluating ExecOS — from a 50-staff restaurant owner to a
 * Fortune 500 division president. The structure is:
 *   1. Universal problem (everyone recognizes)
 *   2. Same problem at different scales (restaurant → SMB → mid-market → F500)
 *   3. What ExecOS does in plain English
 *   4. Three concrete walkthroughs at three different scales
 *   5. What makes it different from generic AI
 *   6. What this means for the business at each scale
 *   7. How to start small
 *
 * Voice: plain English, no jargon, concrete examples. The constitutional
 * discipline is the backbone but is invisible in the pitch itself.
 */

// ─── Slide registry ───────────────────────────────────────────

const SLIDES = [
  "cover",
  "universal-problem",
  "scale-quick",
  "cost",
  "what-it-is",
  "how-it-works",
  "restaurant",
  "smb",
  "midmarket",
  "f500",
  "different",
  "business-impact",
  "size-fit",
  "start",
  "close",
] as const;
type SlideId = (typeof SLIDES)[number];

export default function PitchPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCounter, setShowCounter] = useState(true);
  const slideRefs = useRef<Record<SlideId, HTMLElement | null>>(
    {} as Record<SlideId, HTMLElement | null>
  );

  const scrollTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, idx));
    const id = SLIDES[clamped];
    if (!id) return;
    const el = slideRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveIndex(clamped);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when the user is in an input/textarea (none here, but defensive).
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        scrollTo(activeIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        scrollTo(activeIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        scrollTo(SLIDES.length - 1);
      } else if (e.key === "s" || e.key === "S") {
        setShowCounter((s) => !s);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, scrollTo]);

  // Track active slide as user scrolls naturally
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const id = entry.target.getAttribute("data-slide") as SlideId | null;
            if (id) {
              const idx = SLIDES.indexOf(id);
              if (idx >= 0) setActiveIndex(idx);
            }
          }
        }
      },
      { threshold: [0.5] }
    );
    for (const id of SLIDES) {
      const el = slideRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const slideRef = (id: SlideId) => (el: HTMLElement | null) => {
    slideRefs.current[id] = el;
  };

  return (
    <div className="bg-base text-primary">
      {/* Cover */}
      <Slide ref={slideRef("cover")} id="cover">
        <div className="text-center max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8232C] to-[#F75663] flex items-center justify-center shadow-glow">
              <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight">ExecOS</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-brand mb-6">
            A product presentation
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-primary leading-tight tracking-tight mb-8">
            Better decisions for any team that wants to remember how they got
            here.
          </h1>
          <p className="text-base text-secondary leading-relaxed mb-12 max-w-xl mx-auto">
            From a 50-staff restaurant to a Fortune 500 division — the problem
            is the same. The scale is different. The product is the same too.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <ChevronDown className="w-4 h-4 animate-bounce" aria-hidden="true" />
            <span>Use arrow keys or scroll</span>
          </div>
        </div>
      </Slide>

      {/* Universal problem */}
      <Slide ref={slideRef("universal-problem")} id="universal-problem">
        <div className="text-center max-w-4xl">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            The universal problem
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight mb-8">
            Every team makes decisions.
            <br />
            <span className="text-brand">
              Almost none of them remember why.
            </span>
          </h2>
          <p className="text-lg text-secondary leading-relaxed max-w-2xl mx-auto">
            It doesn&apos;t matter if the team is 50 people or 50,000. The same
            structural gap shows up at every scale: decisions get made, the
            reasoning evaporates, and the team has to relearn it the next time
            the same situation comes around.
          </p>
        </div>
      </Slide>

      {/* Same problem at different scales */}
      <Slide ref={slideRef("scale-quick")} id="scale-quick">
        <div className="max-w-5xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            Same problem, different stakes
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            What this sounds like at four different sizes.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScaleQuote
              icon={ChefHat}
              size="50-staff restaurant"
              quote="Why did we stop ordering from that fish supplier? Everyone who remembered is gone."
            />
            <ScaleQuote
              icon={Building2}
              size="200-staff agency"
              quote="Why did we drop that client last year? There was a reason — we just can't reconstruct it."
            />
            <ScaleQuote
              icon={Users}
              size="2,000-staff mid-market"
              quote="Why did we restructure the regional teams in 2023? I'm being asked to undo it and I don't know what we learned."
            />
            <ScaleQuote
              icon={Landmark}
              size="Fortune 500 division"
              quote="Why did we approve this M&A direction six quarters ago? The board wants the reasoning, and the team that made the call has rotated out."
            />
          </div>
          <p className="text-sm text-muted italic text-center mt-10 max-w-2xl mx-auto">
            Different scale. Same gap. Same cost.
          </p>
        </div>
      </Slide>

      {/* The cost */}
      <Slide ref={slideRef("cost")} id="cost">
        <div className="max-w-5xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            What it costs you
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            Four costs every team is paying — most without noticing.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CostCard
              icon={BookOpen}
              title="Decisions disappear"
              body="The team made a good call in a meeting. A month later, no one remembers why. The same problem gets rediscussed, the same workarounds get reinvented."
            />
            <CostCard
              icon={UserMinus}
              title="Knowledge walks out the door"
              body="Your best people carry years of context in their heads. When they leave, the next person starts from scratch — and makes mistakes the company already learned from."
            />
            <CostCard
              icon={Repeat}
              title="Same mistakes, repeated"
              body="If something has gone wrong three times this quarter, somebody should be connecting the dots. But everyone's too busy solving each instance one at a time."
            />
            <CostCard
              icon={Eye}
              title="AI tools you can't see"
              body="Half your team is quietly using ChatGPT or similar to draft messages, shape plans, make calls. You don't see the advice, you can't verify it, and you can't learn from it as a team."
            />
          </div>
        </div>
      </Slide>

      {/* What ExecOS is */}
      <Slide ref={slideRef("what-it-is")} id="what-it-is">
        <div className="text-center max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            What ExecOS is
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight mb-8">
            A second brain for how your team makes calls.
          </h2>
          <p className="text-lg text-secondary leading-relaxed mb-6">
            ExecOS is software that captures the reasoning behind every
            decision your team makes — and learns what actually worked.
          </p>
          <p className="text-base text-secondary leading-relaxed">
            It uses AI, but the AI is built to help your team think, not
            replace their thinking. It lives next to the tools you already
            use. It captures what those tools throw away.
          </p>
        </div>
      </Slide>

      {/* How it works */}
      <Slide ref={slideRef("how-it-works")} id="how-it-works">
        <div className="max-w-4xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            Five simple steps, then it just keeps running.
          </h2>
          <div className="space-y-3">
            {[
              ["Things happen", "Tasks get done. Status changes. Decisions get made. Meetings happen. ExecOS quietly captures each of these as a permanent record."],
              ["Patterns get noticed", "When the same kind of thing keeps happening, ExecOS flags it. One late task is anecdote. Three late tasks across two teams is a pattern worth knowing."],
              ["You walk through the hard ones", "When something looks worth a real decision, your team works through a short structured conversation. What's happening, what they think, what they'd do. The AI offers perspective with reasoning."],
              ["You decide", "The AI never makes the call. You do. The whole conversation gets saved — including the AI's perspective and yours."],
              ["The team gets sharper over time", "Months later, you mark whether the decision actually worked. ExecOS only learns from the outcomes that held. Generic AI plateaus on day one. ExecOS sharpens every month."],
            ].map(([title, body], i) => (
              <div key={title} className="glass-card p-4 flex gap-4">
                <div
                  aria-hidden="true"
                  className="w-9 h-9 rounded-lg bg-[#C8232C]/15 border border-[#C8232C]/30 text-brand text-sm font-bold flex items-center justify-center flex-shrink-0"
                >
                  {i + 1}
                </div>
                <div>
                  <p className="text-base font-semibold text-primary">{title}</p>
                  <p className="text-sm text-secondary mt-1 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Slide>

      {/* Restaurant example */}
      <Slide ref={slideRef("restaurant")} id="restaurant">
        <ExampleSlide
          icon={ChefHat}
          tagline="Example · 50-staff restaurant"
          title="The head chef wants to switch fish suppliers."
          situation="Friday afternoon. The head chef tells the owner she wants to drop the current fish vendor and switch to a new one she's been talking to. Better pricing, fresher product. The owner has a nagging memory that there was a problem with this same vendor before — but can't remember what."
          journey={[
            "The owner opens ExecOS and starts a decision walkthrough.",
            "ExecOS surfaces a prior episode: 18 months ago this same supplier was tried, billed twice, and had a temperature-log issue that nearly caused a food-safety incident.",
            "The owner shows the chef. They walk through what's different this time — new ownership at the supplier, a different delivery route, a 90-day trial structure.",
            "The chef writes down WHY she still wants to switch, given the prior history.",
            "Decision made: cautious 90-day trial, supplier on probation.",
          ]}
          outcome="Six months from now, when fish costs spike again, the next chef can read the actual history. The mistake doesn't get re-made for the third time."
        />
      </Slide>

      {/* SMB example */}
      <Slide ref={slideRef("smb")} id="smb">
        <ExampleSlide
          icon={Building2}
          tagline="Example · 300-staff marketing agency"
          title="A regional manager wants to merge two roles."
          situation="The regional manager proposes merging the account-strategist and project-manager roles. She thinks it'll save money and speed up delivery. The COO agrees in principle but has a feeling this has been tried before."
          journey={[
            "The COO opens ExecOS and starts a decision walkthrough.",
            "ExecOS surfaces a similar restructure from 2023: the same merge was tried, the rate of missed deliverables spiked, and the merge was reversed within four months. The reasoning at the time was written down: the two roles serve different stakeholders.",
            "The COO shares this with the regional manager. They discuss what's actually different now (better tooling, a different client mix).",
            "The manager proposes a modified structure that addresses what failed last time.",
            "Decision made: a targeted pilot on two accounts, not the whole region.",
          ]}
          outcome="A mistake the company already paid to learn isn't paid for a second time. The current call gets recorded so the next regional manager — three years from now — doesn't have to start from zero."
        />
      </Slide>

      {/* F500 example */}
      <Slide ref={slideRef("midmarket")} id="midmarket">
        <ExampleSlide
          icon={Landmark}
          tagline="Example · Fortune 500 division"
          title="The division president is approving a vendor consolidation."
          situation="A $400M division president is being asked to approve consolidating fifteen vendor relationships into three. The team that built the proposal believes it's the right call. The president has limited time and ultimate accountability."
          journey={[
            "The president opens ExecOS and starts a structured decision walkthrough.",
            "ExecOS surfaces the patterns: which similar consolidations across the company have produced held outcomes, which suggestions from the AI in similar past decisions were rejected and why, what the divisions that took this path actually saved versus what they predicted.",
            "The president states his own read first. The AI offers a sharpened version of the proposal, naming two assumptions the team made that didn't hold in previous consolidations.",
            "The team revises the plan to address the named risks.",
            "Decision approved with the reasoning preserved in full.",
          ]}
          outcome="When the board reviews the consolidation outcome in twelve months, the full reasoning is available. Not a slide deck — the actual conversation, the evidence considered, the alternatives weighed, and why this call was made. Defensible by construction."
        />
      </Slide>

      {/* F500 board summary */}
      <Slide ref={slideRef("f500")} id="f500">
        <div className="text-center max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-brand mb-4">
            Same product, every scale
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-8">
            Notice what didn&apos;t change across those three examples.
          </h2>
          <div className="space-y-4 text-left text-base text-secondary leading-relaxed">
            <p>
              The restaurant owner, the agency COO, and the F500 division
              president were using the <em>same product</em>, going through
              the <em>same walkthrough</em>, getting the <em>same kind of
              reasoning trail</em>.
            </p>
            <p>
              What scaled were the consequences. The restaurant avoided a
              food-safety repeat. The agency avoided a four-month detour. The
              F500 produced a board-grade record of a strategic call.
            </p>
            <p className="text-primary">
              The product is a memory system for how your team makes calls.
              At every scale, it earns its place by making the next call
              sharper than the last one.
            </p>
          </div>
        </div>
      </Slide>

      {/* What's actually different */}
      <Slide ref={slideRef("different")} id="different">
        <div className="max-w-5xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            What&apos;s actually different about this
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            ExecOS does four things no general-purpose AI does.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DifferentiatorCard
              icon={ShieldCheck}
              title="It refuses to assert without evidence"
              body="Generic AI gives you a confident answer whether or not it understands the situation. ExecOS stays silent until there's enough evidence on the record to back what it's saying."
            />
            <DifferentiatorCard
              icon={Brain}
              title="It asks you first"
              body="The AI never opens with its own view. You state your read first. Only then does it add perspective — with the reasoning behind it, so you can disagree with the reasoning, not just the answer."
            />
            <DifferentiatorCard
              icon={Sparkles}
              title="It learns YOUR team specifically"
              body="Most AI is one model serving every customer the same way. ExecOS builds a private memory for your team — your vocabulary, what's worked, what hasn't, what got rejected and why."
            />
            <DifferentiatorCard
              icon={CheckCircle2}
              title="It measures outcomes, not agreement"
              body="Generic AI learns from what users accepted. ExecOS only learns from outcomes that actually held — so the AI gets sharper based on what really worked, not what sounded good."
            />
          </div>
        </div>
      </Slide>

      {/* Business impact */}
      <Slide ref={slideRef("business-impact")} id="business-impact">
        <div className="max-w-4xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            What this means for your business
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            Not flashier dashboards. Just clearer thinking, captured.
          </h2>
          <div className="space-y-3">
            {[
              ["Fewer repeated mistakes", "Patterns get caught earlier. Your team stops solving the same problem twice."],
              ["Faster onboarding", "New hires read the real history of how decisions are made here. They start contributing in week two, not month six."],
              ["Shorter meetings", "Hard decisions get a structured place to live. Stop using your weekly leadership meeting to rediscuss the same issues."],
              ["AI confidence without losing control", "Instead of people quietly using ChatGPT and you wondering what they're getting back, the AI is in the workflow with full transparency."],
              ["Knowledge that survives turnover", "When key people leave, the reasoning behind their decisions stays. The next person doesn't restart the company's learning curve."],
              ["A record you can stand behind", "Whether the audience is a chef, an investor, an auditor, or a board — the reasoning behind every decision is preserved and reviewable."],
            ].map(([headline, body], i) => (
              <div key={headline} className="glass-card p-4 flex gap-4">
                <div
                  aria-hidden="true"
                  className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold flex items-center justify-center flex-shrink-0"
                >
                  {i + 1}
                </div>
                <div>
                  <p className="text-base font-semibold text-primary">{headline}</p>
                  <p className="text-sm text-secondary mt-1 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Slide>

      {/* Size fit */}
      <Slide ref={slideRef("size-fit")} id="size-fit">
        <div className="max-w-5xl w-full">
          <p className="text-xs uppercase tracking-widest text-muted mb-3 text-center">
            How it fits at your size
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12 leading-tight">
            The same product. Different value at every scale.
          </h2>
          <div className="space-y-3">
            <SizeFit
              icon={ChefHat}
              label="Small business · 10–100 staff"
              value="Replaces tribal knowledge with a record. The decisions key people make stop disappearing when those people get busy or leave."
            />
            <SizeFit
              icon={Building2}
              label="Growing company · 100–1,000 staff"
              value="Captures institutional memory you don't yet have. By month six, the AI knows the company's patterns better than any single person inside it."
            />
            <SizeFit
              icon={Users}
              label="Mid-market · 1,000–10,000 staff"
              value="Gives every team head the same structured cadence for decisions. Eliminates the gap between divisions that make good calls and ones that don't — because the cadence travels."
            />
            <SizeFit
              icon={Landmark}
              label="Fortune 500 · 10,000+ staff"
              value="Every material decision produces a full reasoning record. Board reviews, audit responses, regulatory inquiries can be answered with the actual reasoning — not reconstructed slides."
            />
          </div>
        </div>
      </Slide>

      {/* How to start */}
      <Slide ref={slideRef("start")} id="start">
        <div className="text-center max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            How to start
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight mb-8">
            One decision this week.
          </h2>
          <p className="text-lg text-secondary leading-relaxed mb-10 max-w-2xl mx-auto">
            You don&apos;t have to roll this out across the company. Take one
            real decision your team is wrestling with right now — a vendor
            switch, a structure change, an approval — and walk it through
            ExecOS. See if the conversation that comes out is one you&apos;d
            want preserved.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10 max-w-2xl mx-auto">
            <StartStep
              icon={Lightbulb}
              n="1"
              title="Pick a real decision"
              body="Something your team is actually deciding this week."
            />
            <StartStep
              icon={GitMerge}
              n="2"
              title="Walk it through ExecOS"
              body="The structured conversation takes about 15 minutes."
            />
            <StartStep
              icon={Zap}
              n="3"
              title="Keep what you preserve"
              body="If the saved reasoning is something you'd want six months from now — keep going."
            />
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Start your first decision <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </Slide>

      {/* Close */}
      <Slide ref={slideRef("close")} id="close">
        <div className="text-center max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8232C] to-[#F75663] flex items-center justify-center shadow-glow">
              <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight">ExecOS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight mb-6">
            Better decisions, remembered.
          </h2>
          <p className="text-base text-secondary leading-relaxed mb-10 max-w-xl mx-auto">
            Whether your team is 50 or 50,000, the gap is the same: decisions
            without reasoning, repeated mistakes, knowledge that walks out the
            door. ExecOS closes the gap one decision at a time.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
            >
              Get started — free preview
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="text-xs text-brand hover:text-primary px-5 py-3"
            >
              Back to the main page
            </Link>
          </div>
        </div>
      </Slide>

      {/* Floating nav controls */}
      <div className="fixed bottom-6 inset-x-0 flex items-center justify-center pointer-events-none z-40">
        <div className="pointer-events-auto flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-default rounded-full px-3 py-2 shadow-lg">
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous slide"
            className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-raised disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          {showCounter && (
            <span className="text-[10px] text-muted font-mono px-2 tabular-nums">
              {activeIndex + 1} / {SLIDES.length}
            </span>
          )}
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            disabled={activeIndex === SLIDES.length - 1}
            aria-label="Next slide"
            className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-raised disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Subtle hint at top right */}
      <div className="fixed top-4 right-4 z-40 pointer-events-none">
        <p className="text-[10px] text-muted font-mono">
          press <kbd className="bg-surface border border-default rounded px-1">S</kbd> to toggle counter
        </p>
      </div>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────

const Slide = ({
  children,
  id,
  ref,
}: {
  children: React.ReactNode;
  id: SlideId;
  ref?: (el: HTMLElement | null) => void;
}) => (
  <section
    ref={ref}
    data-slide={id}
    className="min-h-screen flex items-center justify-center px-6 py-20 snap-start"
  >
    {children}
  </section>
);

function ScaleQuote({
  icon: Icon,
  size,
  quote,
}: {
  icon: React.ComponentType<{ className?: string }>;
  size: string;
  quote: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
        <p className="text-[10px] uppercase tracking-widest text-muted">
          {size}
        </p>
      </div>
      <p className="text-sm text-primary leading-relaxed italic">
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}

function CostCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function ExampleSlide({
  icon: Icon,
  tagline,
  title,
  situation,
  journey,
  outcome,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  title: string;
  situation: string;
  journey: string[];
  outcome: string;
}) {
  return (
    <div className="max-w-4xl w-full">
      <div className="flex items-center gap-2 mb-3 justify-center">
        <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
        <p className="text-xs uppercase tracking-widest text-brand">
          {tagline}
        </p>
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-10 leading-tight">
        {title}
      </h2>
      <div className="space-y-5">
        <div className="glass-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
            The situation
          </p>
          <p className="text-sm text-primary leading-relaxed">{situation}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-3">
            What happens with ExecOS
          </p>
          <ol className="space-y-2">
            {journey.map((step, i) => (
              <li
                key={i}
                className="flex gap-3 text-sm text-secondary leading-relaxed"
              >
                <span
                  aria-hidden="true"
                  className="text-brand font-bold flex-shrink-0"
                >
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="glass-card p-5 bg-emerald-500/[0.04] border-emerald-500/20">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-2">
            The outcome
          </p>
          <p className="text-sm text-primary leading-relaxed">{outcome}</p>
        </div>
      </div>
    </div>
  );
}

function DifferentiatorCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function SizeFit({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card p-4 flex items-start gap-4">
      <div
        aria-hidden="true"
        className="w-10 h-10 rounded-lg bg-[#C8232C]/15 border border-[#C8232C]/30 text-brand flex items-center justify-center flex-shrink-0"
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-primary mb-1">{label}</p>
        <p className="text-sm text-secondary leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

function StartStep({
  icon: Icon,
  n,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-card p-4 text-left">
      <div className="flex items-center gap-2 mb-2">
        <div
          aria-hidden="true"
          className="w-6 h-6 rounded-full bg-[#C8232C]/15 border border-[#C8232C]/30 text-brand text-xs font-bold flex items-center justify-center"
        >
          {n}
        </div>
        <Icon className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
        <p className="text-xs font-semibold text-primary">{title}</p>
      </div>
      <p className="text-xs text-secondary leading-relaxed">{body}</p>
    </div>
  );
}
