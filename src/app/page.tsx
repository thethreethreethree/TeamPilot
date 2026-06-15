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
  Repeat,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BrandLogo, LightbulbMark } from "@/components/brand/Logo";

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
    title: "Understanding precedes solving.",
    body: "Before any action, ELOSTATE asks your team to name the actual problem — not the symptom. The discipline is structural, not advisory. Tasks can't be acted on until the gate is cleared. Decisions can't be asserted until the team states their own read first.",
  },
  {
    icon: Sparkles,
    title: "The AI teaches. It doesn't take over.",
    body: "Our Coach reads your team's drafts and surfaces patterns — never verdicts. It asks the question; your team renders the call. Over time, the Coach learns each individual's communication patterns and helps them grow, instead of doing the work for them.",
  },
  {
    icon: GitMerge,
    title: "Every decision has a paper trail. Permanently.",
    body: "Every meaningful call your team makes — situation, diagnosis, reasoning, outcome — lands on an append-only record. Six months later, anyone can read the WHY. The record is the institutional memory most companies don't realize they're losing.",
  },
  {
    icon: Eye,
    title: "Whatever the System sees about you, you can see.",
    body: "There is no shadow read. The data ELOSTATE forms about a person — their engagement patterns, their communication grades, the principles the Coach has cited to them — is visible to that person at the same level of detail. Transparency is structural, not policy.",
  },
];

const method = [
  {
    step: "1",
    title: "Understand",
    body: "The team names what's actually happening. Patterns from past incidents surface as evidence. Half-understood problems can't reach action — the schema itself enforces it.",
  },
  {
    step: "2",
    title: "Engage",
    body: "Decisions get a structured space to live. The 4-phase Decision Dialogue surfaces the situation, the team's read, the System's perspective, and the choice — with reasoning preserved for whoever reads it next.",
  },
  {
    step: "3",
    title: "Resolve",
    body: "Actions land as tasks with explicit gates: what we're accomplishing, what we have, who's involved. Step-by-step progress is tracked transparently, with the Coach available at each step.",
  },
  {
    step: "4",
    title: "Learn",
    body: "Outcomes feed back into the record. The System gets sharper about your specific team over time. Patterns you would have missed surface earlier. The loop closes, and the next problem starts with everything you've already learned.",
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
            <Link
              href="/login"
              className="text-secondary hover:text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors"
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

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
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
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What ELOSTATE actually is
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-6 max-w-3xl mx-auto leading-tight">
          A discipline, made executable.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-3xl mx-auto text-center mb-10">
          ELOSTATE is not productivity software with AI features bolted
          on. It is a problem-solving discipline encoded as runtime —
          a participant in your team&apos;s thinking that notices,
          surfaces, suggests, and remembers. The constitution that
          governs how it behaves is the same constitution governing
          how we built it. Competitors can copy features. They cannot
          easily copy a discipline.
        </p>

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {method.map((m) => (
            <div key={m.step} className="glass-card p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div
                  aria-hidden
                  className="w-8 h-8 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/30 text-brand text-sm font-bold flex items-center justify-center"
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
        <div className="glass-card p-8 md:p-10 border border-[#FACC15]/30 bg-[#FACC15]/[0.03]">
          <div className="flex items-start gap-3 mb-4">
            <Hourglass className="w-5 h-5 text-brand shrink-0 mt-1" aria-hidden />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-brand font-semibold mb-1">
                Our refusal is the proof
              </p>
              <h2 className="text-xl md:text-3xl font-bold text-primary leading-tight">
                We refuse to deliver instant results.<br className="hidden md:inline" />
                {" "}<span className="text-brand">And that&apos;s the point.</span>
              </h2>
            </div>
          </div>
          <div className="text-sm md:text-base text-secondary leading-relaxed space-y-3 mt-6">
            <p>
              Your first 30 days on ELOSTATE, the AI guidance is OFF
              by default — intentionally. We&apos;re capturing an
              honest baseline of how your team operates before any AI
              guidance touches the work.
            </p>
            <p>
              On Day 30, the guidance unlocks. The next 30 days are a
              single-variable intervention — the only thing that
              changed is the System. Any improvement is attributable
              to the method, not to luck or circumstance.
            </p>
            <p>
              On Day 60, you have actual evidence. Most software
              promises results on day one — which means most software
              is claiming understanding it cannot possibly have.
              We&apos;d rather lose the impatient customer than ship a
              lie.
            </p>
            <p className="text-primary font-semibold pt-2">
              The discipline that built the product is the discipline
              that demonstrates it works.
            </p>
          </div>
        </div>
      </section>

      {/* Outcomes — what changes for the business */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What changes for your business
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-10 leading-tight">
          The boring version:<br className="hidden md:inline" />
          {" "}<span className="text-brand">your team gets sharper at thinking together.</span>
        </h2>
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
            No — by constitutional rule. The System asks your team
            what they think first, surfaces patterns it has noticed,
            and offers a perspective with explicit reasoning. Your
            team renders every verdict. The AI is a participant in
            thinking, not a substitute for it.
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
            Whatever ELOSTATE sees about a person, that person can
            see. There is no shadow read. Your team&apos;s data is
            yours — not shared, not used to train models for anyone
            else. Read the full{" "}
            <Link href="/privacy" className="text-brand underline">
              Privacy Policy
            </Link>{" "}
            for the structural details.
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
            className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm"
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
