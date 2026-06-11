"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CircleHelp,
  Lightbulb,
  MessageSquare,
  Repeat,
  Sparkles,
  UserMinus,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/**
 * Landing page — rewritten 2026-06-02 for a non-technical business owner.
 *
 * Audience: founder / CEO / COO of a 20–500 person business. Uses Slack and a
 * task tracker, has heard of ChatGPT but isn't an AI expert. Lives in customers,
 * cash flow, hiring, and decisions — not in compliance frameworks.
 *
 * Voice rules in this rewrite:
 *  - No jargon. Words that need translation are banned: auditable, defensible,
 *    compliance, regulatory, structural, AI category, schema, framework.
 *  - Lead with the team problem they recognize, in plain English.
 *  - Translate every feature to a concrete business outcome.
 *  - Constitutional discipline is the backbone but it's almost invisible —
 *    one footer line. The product is the deliverable, not the philosophy.
 */

const teamProblems = [
  {
    icon: BookOpen,
    title: "Decisions disappear",
    body: "Your team makes good decisions in meetings. A month later, nobody remembers why. The same problems get rediscussed. The same workarounds get reinvented.",
  },
  {
    icon: UserMinus,
    title: "When people leave, knowledge leaves with them",
    body: "Your best people carry years of context in their heads. When they go, the next person starts from scratch — and makes the same mistakes the company already learned from.",
  },
  {
    icon: MessageSquare,
    title: "Half the team is quietly using AI",
    body: "People are using ChatGPT or other tools to draft messages, write plans, and shape decisions. You don't see what advice they're getting, whether it's right, or how to learn from it as a team.",
  },
  {
    icon: Repeat,
    title: "The same issues keep coming back",
    body: "If something has gone wrong three times this quarter, you'd want to know. But nobody on your team is connecting the dots — they're too busy solving each instance one at a time.",
  },
];

const benefits = [
  {
    icon: Brain,
    title: "Every decision has a paper trail",
    body: "Your team walks through a structured conversation for any meaningful decision. What's happening, what they think is going on, what they'd do. The reasoning is saved. Six months later, anyone can read it and understand the call.",
  },
  {
    icon: Sparkles,
    title: "Patterns get caught early",
    body: "ELOSTATE watches what's happening across your team — tasks, status changes, recurring issues. When something is showing up over and over, it flags it. Before it flags it, it shows you the evidence.",
  },
  {
    icon: Users,
    title: "Knowledge survives turnover",
    body: "Every decision your team makes — and the reasoning behind it — becomes part of your team's memory. When someone leaves, the next person starts with the actual history of how things get decided here, not a blank page.",
  },
  {
    icon: Lightbulb,
    title: "AI that helps the team think, not skip thinking",
    body: "The AI never tells you what to do. It asks what you think first, then offers its own perspective with the reasoning behind it. You stay in charge of every call. The AI just makes sure you're looking at the right things before you make it.",
  },
];

const outcomes = [
  ["Fewer repeated mistakes.", "Your team stops solving the same problem twice."],
  ["Faster onboarding.", "New hires can read the real history of how decisions get made here."],
  ["Shorter, better meetings.", "Hard decisions get a structured place to live, so the weekly leadership meeting stops being a rerun."],
  ["Confidence in AI without losing control.", "Instead of people quietly using ChatGPT and you wondering what they're getting back, AI is built into the workflow with full transparency."],
  ["Real institutional memory.", "Six months in, ELOSTATE knows how your team makes calls. Two years in, it's a record competitors will never have."],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-base text-primary">
      {/* Header — theme-aware surface so the page chrome flips with the rest. */}
      <header className="border-b border-default bg-base/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C8232C] to-[#F75663] flex items-center justify-center shadow-glow">
              <Activity className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-tight text-primary">ELOSTATE</span>
          </div>
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
              className="flex items-center gap-1.5 bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Get started <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — plain-English headline, team-problem framing */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <p className="text-xs uppercase tracking-widest text-brand mb-4">
          Better decisions for growing teams
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-primary leading-tight tracking-tight mb-5">
          Your team makes big decisions every week.
          <br className="hidden md:inline" />
          {" "}Will you remember why six months from now?
        </h1>
        <p className="text-base text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
          ELOSTATE is software that helps your team think clearly together, write
          down the reasoning behind every decision, and learn from what
          actually worked. It uses AI — but the AI is built to help your team
          think, not replace their thinking.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Try ELOSTATE <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/pitch"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            Watch the pitch →
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-brand hover:text-primary px-5 py-3"
          >
            See it in action →
          </Link>
        </div>
        <p className="text-[10px] text-muted mt-4 font-mono">
          Free preview · no setup needed
        </p>
      </section>

      {/* The problem the team recognizes */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          The problem most growing teams have
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-5 max-w-3xl mx-auto leading-tight">
          It&apos;s not that your team isn&apos;t smart. <br className="hidden md:inline" />
          {" "}It&apos;s that nobody&apos;s writing down what they figured out.
        </h2>
        <p className="text-sm text-secondary leading-relaxed max-w-3xl mx-auto text-center mb-12">
          Most teams under 500 people run on the memory of a handful of key
          people. That works — right up until those people get pulled in too
          many directions, or leave. The decisions that should compound into
          institutional knowledge are evaporating instead.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamProblems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className="w-4 h-4 text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted italic text-center mt-8 max-w-2xl mx-auto">
          You feel these every week. ELOSTATE exists to close them — one team
          decision at a time.
        </p>
      </section>

      {/* What ELOSTATE actually does — plain English */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What ELOSTATE actually does
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-3 max-w-3xl mx-auto leading-tight">
          A second brain for how your team makes calls.
        </h2>
        <p className="text-sm text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-12">
          ELOSTATE lives next to the tools your team already uses. It doesn&apos;t
          replace your task tracker or your chat app — it captures the
          reasoning that those tools throw away.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className="w-4 h-4 text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">{b.title}</h3>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* What this means for the business — outcome-led */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          What this means for your business
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-10 leading-tight">
          The boring version: your team gets better at deciding.
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
        <p className="text-xs text-muted italic text-center mt-8 max-w-2xl mx-auto">
          Not flashier dashboards. Not faster output. Just clearer thinking,
          captured — every week, getting better at your specific team.
        </p>
      </section>

      {/* Skeptic catcher */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          A few honest questions you might be having
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-10 leading-tight">
          Is this actually different from the other AI tools?
        </h2>
        <div className="space-y-5 text-sm text-secondary leading-relaxed">
          <div>
            <p className="text-primary font-semibold mb-1">
              &quot;Will my team actually use this?&quot;
            </p>
            <p>
              ELOSTATE sits in the moments your team is already pausing — the
              hard decision, the messy meeting, the recurring problem. It
              doesn&apos;t add work; it gives the work you already do a place
              to live where it stops getting lost.
            </p>
          </div>
          <div>
            <p className="text-primary font-semibold mb-1">
              &quot;We already use ChatGPT. Why this?&quot;
            </p>
            <p>
              ChatGPT is a smart assistant for one person. ELOSTATE is a memory
              system for the whole team. ChatGPT forgets the conversation as
              soon as you close the tab. ELOSTATE remembers — and learns from
              what actually worked here over months.
            </p>
          </div>
          <div>
            <p className="text-primary font-semibold mb-1">
              &quot;Won&apos;t the AI just tell my team what to do?&quot;
            </p>
            <p>
              No — and on purpose. The AI is built to ask your team what they
              think first, then offer perspective. Your team stays in charge
              of every decision. The AI just makes sure they&apos;re looking
              at the right things first.
            </p>
          </div>
          <div>
            <p className="text-primary font-semibold mb-1">
              &quot;Is my data safe?&quot;
            </p>
            <p>
              Your data is yours. It lives in your own account. You can
              export everything at any time. The AI that learns from your team
              learns only about your team — never shared, never used to train
              models for someone else.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-4">
          Start with one decision this week.
        </h2>
        <p className="text-sm text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          You don&apos;t have to roll this out across the whole team to see
          whether it works. Take one real decision your team is wrestling with
          right now, walk it through ELOSTATE, and see if the conversation that
          comes out is one you&apos;d want preserved.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] text-white font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Get started — free preview{" "}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            <CircleHelp className="w-4 h-4" aria-hidden="true" /> See it in action
          </Link>
        </div>
      </section>

      {/* Footer — the discipline is named, but its source document is
          the user's private IP and not linked. */}
      <footer className="border-t border-default mt-10 px-6 py-8 text-center">
        <p className="text-[10px] text-muted mb-1">
          ELOSTATE is built on a strict discipline we call our constitution —
          the rules of the System are encoded as runtime, not advisory.
        </p>
        <p className="text-[10px] text-muted">
          © {new Date().getFullYear()} ELOSTATE · Constitution v1.4 · 4 amendments ratified
        </p>
      </footer>
      <InstallPrompt />
    </div>
  );
}
