"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CircleHelp,
  Eye,
  GitMerge,
  Hourglass,
  MessageSquare,
  MessageSquarePlus,
  Repeat,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BrandLogo, LightbulbMark } from "@/components/brand/Logo";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Landing page — rewritten 2026-06-15 to surface the actual category
 * claim, not a softer productivity-tool framing.
 *
 * The product is not a better Notion. It is a problem-solving engine
 * that runs the §1 Living Diagnosis loop against your team's actual
 * work. Visitors must leave understanding that we are a different
 * category — not a comparison shop against Asana, Linear, or
 * ChatGPT-for-work.
 *
 * Voice rules:
 *  - Lead with the category claim. Repeat it. Don't soften it.
 *  - Plain English; the discipline is the moat, not the jargon.
 *  - Every section earns the next click — confident but honest.
 *  - Pilot-stage realism is in the copy (no fake "join 10,000
 *    companies" social proof). The §A9 submission IS the credibility.
 */

const teamProblems = [
  {
    icon: Repeat,
    title: "The same problems keep coming back.",
    body: "Your team fixes the symptom. The root cause survives. Three months later, someone hits the same wall — and the team starts the diagnosis from scratch, because nobody recorded what was actually understood the first time.",
  },
  {
    icon: BookOpen,
    title: "Decisions evaporate the moment the meeting ends.",
    body: "The reasoning behind a hard call lives in three people's heads. One leaves. One forgets. One was never in the room. The decision gets rediscussed in six months, with worse context than the first time.",
  },
  {
    icon: MessageSquare,
    title: "AI is helping your team — silently.",
    body: "Half your team is drafting messages through ChatGPT. You can't see what advice they're getting, whether it's right, or whether it's training them to think — or to skip thinking.",
  },
  {
    icon: GitMerge,
    title: "Knowledge leaves when people leave.",
    body: "Your senior people carry the company's actual reasoning in their heads. When they go, the next person rebuilds it from instinct — and the team relives lessons it already paid for.",
  },
];

const differentiators = [
  {
    icon: Brain,
    title: "It makes your team slow down — at the right moments.",
    body: "Most software optimizes for speed. ELOSTATE optimizes for accuracy. At the moments that actually matter — a hard decision, a recurring issue, a missed call — the System slows the team down just enough to name what's really going on. The hours saved are downstream.",
  },
  {
    icon: Sparkles,
    title: "The AI is a participant, not an autopilot.",
    body: "Other AI tools draft for you. ELOSTATE's Coach reads what your team is writing, notices patterns, and surfaces a perspective with the reasoning behind it. Your team renders every verdict. Over time the Coach learns each individual and helps them grow as a communicator — instead of doing the communicating for them.",
  },
  {
    icon: GitMerge,
    title: "Reasoning, captured. Decisions, durable.",
    body: "Every meaningful call your team makes — and the reasoning behind it — gets captured and preserved. Six months later, anyone reading the record can understand the WHY, not just the WHAT. This is the institutional memory most companies don't realize they're losing every week.",
  },
  {
    icon: Eye,
    title: "Your data is yours. Visible to you.",
    body: "Anything the System forms an opinion about — patterns in how you work, how the Coach reads your communication — is visible to you in-product. No backstage profile, no scoring panel you can't see. Your data is yours, and the System's read on you is a conversation, not a verdict.",
  },
];

const method = [
  {
    step: "1",
    title: "Diagnose",
    body: "The team names what's actually happening — not the symptom in front of them, but the underlying pattern. The System surfaces evidence from past incidents so the diagnosis is earned, not guessed.",
  },
  {
    step: "2",
    title: "Engage",
    body: "Hard decisions get a structured place to live. The team's read, the System's perspective, and the choice all sit in the same record — with reasoning preserved for whoever reads it next.",
  },
  {
    step: "3",
    title: "Act",
    body: "Action lands with the context attached. Every step is visible, the Coach is available when someone is stuck, and progress is transparent across the team without anyone needing to chase it.",
  },
  {
    step: "4",
    title: "Compound",
    body: "Outcomes feed back into the record. The System gets sharper about your specific team every month. The next problem starts with everything you already learned — and the loop tightens.",
  },
];

const outcomes = [
  ["Recurring problems stop recurring.", "When the team understands the actual cause — and records it — the next instance gets caught earlier or doesn't happen at all."],
  ["New hires arrive into a real history.", "Instead of starting from a blank page, they read how decisions actually get made here. Onboarding stops being institutional re-archaeology."],
  ["Hard meetings get shorter.", "When the structured surface holds the reasoning, the weekly leadership meeting stops being a recap of last week's recap."],
  ["AI is on the record, not in the shadows.", "Every Coach interaction is captured, scoped, and visible to the person it's about. Your team gains from the AI without losing the audit trail."],
  ["The System knows your team better every month.", "Six months in, ELOSTATE has internalized how your team thinks. Two years in, it's organizational knowledge a competitor cannot replicate."],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-base text-primary">
      {/* Header */}
      <header className="border-b border-default bg-base/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ELOSTATE — home">
            <LightbulbMark width={22} height={30} className="flex-shrink-0" />
            <span className="text-sm font-black tracking-tight text-primary">ELOSTATE</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <ThemeToggle />
            {/* Feedback — moved from a floating bottom-right
                button to inline-in-nav per user request. Routes
                to /login with feedback intent so the existing
                auth-gated feedback flow takes over once the
                visitor signs in. */}
            <Link
              href="/login?intent=feedback&from=%2F"
              className="flex items-center gap-1 text-secondary hover:text-primary transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              Feedback
            </Link>
            <Link
              href="/login"
              className="text-secondary hover:text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Request access <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — sharp category claim. Visitor leaves the first 5
          seconds knowing what we are and what we are NOT. */}
      <section className="relative px-6 py-20 md:py-28 max-w-5xl mx-auto text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-start justify-center -z-10"
        >
          <div className="w-[600px] h-[600px] bulb-glow" />
        </div>

        <div className="flex justify-center mb-6">
          <BrandLogo width={160} height={160} priority className="shadow-glow-ember" />
        </div>

        {/* The category claim. Direct. Repeated downstream so it
            sticks even with a fast scroll. */}
        <LearningHint
          as="block"
          category="Home · Hero"
          title="The category claim"
          whatItIs="The first thing a visitor reads: ELOSTATE is a team-based problem-solving engine, not a productivity tool."
          why="Visitors arrive pattern-matching us to Notion, Asana, or ChatGPT. The hero's job is to reject that frame in the first five seconds — a wrong category is harder to undo than a blank slate."
          how="The 'Not a productivity tool' kicker is load-bearing; it's the frame the rest of the page reinforces. Don't soften it to sound friendlier."
          principle="Win the category in five seconds or spend the whole page correcting the guess."
        >
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-4">
          Not a productivity tool
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-primary leading-[1.05] tracking-tight mb-6">
          The team-based <br className="hidden md:inline" />
          <span className="text-brand">problem-solving engine.</span>
        </h1>
        <p className="text-base md:text-lg text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
          Productivity tools optimize how fast your team works. ELOSTATE
          optimizes <em className="text-primary not-italic font-semibold">
          how well your team thinks together</em> — turning recurring
          problems into resolved, recorded, structural knowledge that
          compounds every month.
        </p>
        </LearningHint>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Request pilot access <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/pitch"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            Watch the pitch →
          </Link>
        </div>

        <p className="text-[11px] text-muted mt-5 font-mono">
          Pilot-stage · invite-friendly companies welcome
        </p>
      </section>

      {/* The problem — sharpen the existing framing */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <LearningHint
          as="block"
          category="Home · Problem"
          title="The problem: failing to learn"
          whatItIs="The core problem framing — your team isn't failing to work, it's failing to learn — with the four concrete ways it shows up."
          why="A prospect has to feel the problem before a solution means anything. Naming it as a learning failure (not an effort failure) is what separates us from tools that just make work faster."
          how="Let the four cards do the recognizing — most teams see themselves in at least one before they've read all four."
          principle="Diagnose the gap the visitor already feels; don't invent one they don't."
        >
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          The problem most growing teams have
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-5 max-w-3xl mx-auto leading-tight">
          Your team isn&apos;t failing to work.<br className="hidden md:inline" />
          {" "}<span className="text-brand">It&apos;s failing to learn.</span>
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-3xl mx-auto text-center mb-12">
          Most growing teams run on the memory of three or four key
          people. It works — until those people get pulled in too many
          directions, or leave. The decisions that should compound into
          institutional intelligence evaporate instead. The same
          conversations keep happening. The same mistakes keep landing.
        </p>
        </LearningHint>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamProblems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* What ELOSTATE actually IS — the category claim, expanded.
          This is the section the user explicitly asked for: visitor
          leaves understanding we are not just another productivity
          tool, we are a different category. */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <LearningHint
          as="block"
          category="Home · Category"
          title="A different category"
          whatItIs="The expanded category claim and the four things that make ELOSTATE a participant in your team's thinking, not software with AI bolted on."
          why="This is the section that has to survive the silent 'isn't this just ChatGPT?' It answers by describing behavior — asks first, refuses without evidence, learns your team — not features."
          how="If a visitor only reads one section, it should be this one; it's the whole differentiation in four cards."
          principle="Differentiate on behavior the visitor can verify, not adjectives they can't."
        >
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What ELOSTATE actually is
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-6 max-w-3xl mx-auto leading-tight">
          A different category.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-3xl mx-auto text-center mb-10">
          ELOSTATE is not productivity software with AI features bolted
          on. It is a participant in your team&apos;s thinking — one
          that notices, surfaces, and remembers across people and
          time. The way it behaves is shaped by a strict internal
          discipline. That discipline shows up in every interaction,
          which is why the product feels different the moment you
          start using it.
        </p>
        </LearningHint>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {differentiators.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{b.title}</h3>
                </div>
                <p className="text-xs md:text-sm text-secondary leading-relaxed">
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* The Method — translation of §1 Living Diagnosis loop into
          plain English so the visitor sees the actual engine, not a
          feature list. */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <LearningHint
          as="block"
          category="Home · Method"
          title="How the engine runs"
          whatItIs="The four-phase loop — Diagnose, Engage, Act, Compound — that every problem runs through."
          why="It shows the product is a repeatable method, not a bag of features. 'The schema enforces it' signals the discipline is structural, not advisory."
          how="Read it as one loop that tightens each cycle — the 'Compound' phase is the part competitors can't copy because it's built from your team's own history."
          principle="A method that visibly compounds beats a feature that visibly ships."
        >
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          How the engine runs
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-6 max-w-3xl mx-auto leading-tight">
          One loop. Every problem. Sharper every cycle.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-12">
          Every meaningful problem your team faces runs through the same
          four-phase loop. Skipping a phase isn&apos;t an option — the
          schema enforces it. The same loop is how the System itself
          gets sharper about your team over time.
        </p>
        </LearningHint>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {method.map((m) => (
            <div key={m.step} className="glass-card p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div
                  aria-hidden
                  className="w-8 h-8 rounded-lg bg-ember-400/10 border border-ember-400/30 text-brand text-sm font-bold flex items-center justify-center"
                >
                  {m.step}
                </div>
                <h3 className="text-sm font-semibold text-primary">{m.title}</h3>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                {m.body}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted italic text-center mt-8 max-w-2xl mx-auto">
          Understand → Engage → Resolve → Learn. Then again, with
          everything you just learned baked in.
        </p>
      </section>

      {/* The honesty section — the §3.4 commitment as feature. This
          is the radical move: we don't promise instant results, and
          that refusal IS the moat. Most landing pages would hide
          this. We lead with it. */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <LearningHint
          as="block"
          category="Home · Honesty"
          title="The honesty is the moat"
          whatItIs="The commitment stated as a selling point: no promised day-one results, proof measured against your own baseline."
          why="Most landing pages hide the fact that value takes time. Leading with it is the counter-intuitive move that makes every other claim on the page more credible."
          how="Present it as a strength, not an apology — the willingness to lose the impatient buyer is exactly what earns the serious one."
          principle="The refusal to over-promise is the most persuasive thing on the page."
        >
        <div className="glass-card p-8 md:p-10 border border-ember-400/30 bg-ember-400/[0.03]">
          <div className="flex items-start gap-3 mb-4">
            <Hourglass className="w-5 h-5 text-brand shrink-0 mt-1" aria-hidden />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-brand font-semibold mb-1">
                The honesty IS the moat
              </p>
              <h2 className="text-xl md:text-3xl font-bold text-primary leading-tight">
                We don&apos;t promise day-one results.<br className="hidden md:inline" />
                {" "}<span className="text-brand">We prove them against your baseline.</span>
              </h2>
            </div>
          </div>
          <div className="text-sm md:text-base text-secondary leading-relaxed space-y-3 mt-6">
            <p>
              Most software promises improvement on day one. To do
              that honestly, you&apos;d need to know what the team
              looked like BEFORE the software touched the work — and
              nobody who claims instant results actually does.
            </p>
            <p>
              ELOSTATE takes the slower, more honest path: a short
              measurement window with the AI guidance held back, so
              we can show you what changed against your own
              baseline. Not against a benchmark. Not against a
              promise. Against the team you brought in.
            </p>
            <p>
              We&apos;d rather lose the impatient customer than ship
              a flattering lie. The way we measure is the way we
              earn the trust.
            </p>
            <p className="text-primary font-semibold pt-2">
              The honesty IS the moat.
            </p>
          </div>
        </div>
        </LearningHint>
      </section>

      {/* Outcomes — what changes for the business */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <LearningHint
          as="block"
          category="Home · Outcomes"
          title="What changes for the business"
          whatItIs="The business-level results: recurring problems stop recurring, faster onboarding, shorter meetings, AI on the record, knowledge that survives turnover."
          why="Buyers translate everything into outcomes. This section does that translation for them so the mechanism doesn't have to be understood to be bought."
          how="Pair each outcome with the buyer's own pressure — turnover risk, meeting bloat, onboarding cost."
          principle="Sell the outcome in the buyer's ledger; keep the mechanism in the footnotes."
        >
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What changes for your business
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-10 leading-tight">
          The boring version:<br className="hidden md:inline" />
          {" "}<span className="text-brand">your team gets sharper at thinking together.</span>
        </h2>
        </LearningHint>
        <div className="space-y-3">
          {outcomes.map(([headline, body], i) => (
            <div key={headline} className="glass-card p-4 flex gap-4">
              <div
                aria-hidden="true"
                className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold flex items-center justify-center flex-shrink-0"
              >
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">{headline}</p>
                <p className="text-xs text-secondary mt-1 leading-relaxed">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skeptic catcher — the four hard questions, answered
          honestly. Includes the category-collision questions
          (ChatGPT, Notion AI, etc.) because that's what the visitor
          is actually thinking. */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          The honest questions
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-10 leading-tight">
          What you&apos;re probably wondering.
        </h2>
        <div className="space-y-6 text-sm text-secondary leading-relaxed">
          <Question q="Isn't this just ChatGPT or Notion AI?">
            ChatGPT is a smart assistant for one person; it forgets you
            the moment you close the tab. Notion AI auto-completes
            your prose. ELOSTATE is a team-level participant that
            captures reasoning, surfaces patterns across people and
            time, and teaches your team to think more clearly — not
            faster. Different category, different moat.
          </Question>
          <Question q="Won't the AI just tell my team what to do?">
            No. The System asks your team what they think first and
            offers a perspective with the reasoning behind it. Your
            team makes every call. The AI is there to make sure
            you&apos;re looking at the right things first — not to
            decide for you.
          </Question>
          <Question q="Will my team actually use this?">
            ELOSTATE sits in the moments your team is already pausing —
            the hard decision, the recurring problem, the messy
            meeting. It doesn&apos;t add work; it gives the work
            you&apos;re already doing a place to live where it stops
            getting lost. The Coach surfaces only when there&apos;s
            something worth saying.
          </Question>
          <Question q="What about data and privacy?">
            Your team&apos;s data is yours. We don&apos;t share it,
            we don&apos;t train external models on it, and anything
            we form an opinion about a person is visible to that
            person in-product. Read the full{" "}
            <Link href="/privacy" className="text-brand underline">
              Privacy Policy
            </Link>{" "}
            for the specifics.
          </Question>
        </div>
      </section>

      {/* Closing CTA — pilot-stage realism, confident in scope */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-primary leading-tight mb-4">
          One problem.<br className="hidden md:inline" />
          {" "}<span className="text-brand">One real walk-through.</span>
        </h2>
        <p className="text-sm md:text-base text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          Take one real problem your team is wrestling with this week.
          Walk it through ELOSTATE end-to-end. Read the captured
          reasoning at the end. Decide for yourself whether that
          conversation is one you&apos;d want preserved as part of
          how your team thinks.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Request pilot access{" "}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            <CircleHelp className="w-4 h-4" aria-hidden="true" /> See it in action
          </Link>
        </div>
        <p className="text-[11px] text-muted mt-4 font-mono">
          Pilot-stage · 1-3 friendly companies at a time
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-default mt-10 px-6 py-8 text-center">
        <p className="text-[10px] text-muted mb-1">
          ELOSTATE is built on a strict discipline we call our
          constitution — the rules of the System are encoded as
          runtime, not advisory.
        </p>
        <p className="text-[10px] text-muted mb-2">
          © {new Date().getFullYear()} ELOSTATE
        </p>
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted">
          <Link href="/terms" className="hover:text-primary underline">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-primary underline">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/help" className="hover:text-primary underline">
            Help
          </Link>
        </div>
      </footer>
      <InstallPrompt />
    </div>
  );
}

function Question({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-primary font-semibold mb-1.5 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-brand mt-0.5 shrink-0" aria-hidden />
        {q}
      </p>
      <div className="pl-6">{children}</div>
    </div>
  );
}
