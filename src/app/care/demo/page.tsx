"use client";

/**
 * /care/demo — the C.A.R.E sales demo page.
 *
 * A LIVE, in-product page a salesperson drives in front of a prospect
 * (distinct from the PDF leave-behind). It does three things, in the
 * founder's order:
 *   1. Explains the best feature of the default system (the diagnostic
 *      AI→human handoff + the four internal agent tools).
 *   2. Shows the click-by-click demonstration (CareDemoWalkthrough) — a
 *      self-contained scripted simulation of the real flow, so it can
 *      never fail live in the room.
 *   3. Explains how the system is malleable / adapts to the prospect's
 *      business (CareDemoMalleability — a live business-type toggle + the
 *      real per-tenant config knobs).
 *
 * Design: matches the product's own system — mono-amber tokens (ember +
 * ink), Inter, glass-card / bulb-glow / text-brand — modelled on the
 * landing page so it reads as the product, not a bolt-on. Dark-default
 * with light support via the semantic tokens (bg-base / text-primary…).
 *
 * NOTE (honesty, §3.4): the structured handoff CAPTURE (name / email /
 * concern / order#) shown as the hero feature goes fully live only once
 * `feat/care-handover-capture` + migration 0188 are deployed. The four
 * agent tools (Coach / Co-Pilot / Summarize / Formulate) are already
 * live. Sequence the deploys together so the page never oversells.
 *
 * The global "Jeff" chat widget (mounted in the root layout) is NOT
 * hidden on this path — a prospect can try the real thing bottom-right.
 * The walkthrough is a deliberately distinct framed "replay" panel so
 * the two never read as competing widgets.
 *
 * CTA target is a `[your booking link]` placeholder — fill BOOKING_URL
 * before sending this to prospects.
 */

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Clock,
  ClipboardList,
  HeartHandshake,
  Repeat,
  ShieldCheck,
  Sparkles,
  Zap,
  X,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LightbulbMark } from "@/components/brand/Logo";
import { CareDemoWalkthrough } from "@/components/care/demo/CareDemoWalkthrough";
import { CareDemoMalleability } from "@/components/care/demo/CareDemoMalleability";

// TODO(founder): replace with your real booking / contact link before
// sending this page to prospects. Left as a login fallback so the button
// is never dead in the meantime.
const BOOKING_URL = "/login"; // → [your booking link]

const bestFeature = [
  {
    icon: Zap,
    title: "Answers in seconds — 24/7.",
    body: "An AI first-responder (\"Jeff\") greets every customer instantly, grounded in your business's own product context. No queue, no FAQ maze, no waiting for business hours.",
  },
  {
    icon: HeartHandshake,
    title: "Hands off honestly — never guesses.",
    body: "When something needs a human — a refund, an account action — Jeff says so and brings a teammate in, right in the same thread. No hallucinated answer, no dead-end.",
  },
  {
    icon: ClipboardList,
    title: "Captures the context once.",
    body: "At the handoff the customer gives their name, email, concern and order number a single time. The agent opens the chat already knowing everything — the customer never repeats themselves.",
  },
  {
    icon: Sparkles,
    title: "Makes the agent superhuman.",
    body: "Four built-in tools — Coach, Co-Pilot, Summarize, Formulate — draft, grade, and recap alongside the agent, so replies are faster AND warmer, and quality stays consistent.",
  },
];

// Compare / contrast — the "why we're a league of our own" the founder
// asked for. Framed on behaviour, not adjectives.
const compareRows: { dim: string; chatbot: string; inbox: string; care: string }[] = [
  {
    dim: "After hours",
    chatbot: "Deflects to a FAQ",
    inbox: "Customer waits till morning",
    care: "Jeff answers in seconds, grounded in your product",
  },
  {
    dim: "When it can't help",
    chatbot: "Loops or guesses",
    inbox: "—",
    care: "Hands off honestly, in-thread, reliably",
  },
  {
    dim: "The handoff",
    chatbot: "Customer re-explains to a human",
    inbox: "Agent reads from scratch",
    care: "Name · email · concern · order captured once",
  },
  {
    dim: "The agent's reply",
    chatbot: "—",
    inbox: "On their own",
    care: "Co-Pilot drafts, Coach grades, before it sends",
  },
  {
    dim: "After resolution",
    chatbot: "Nothing kept",
    inbox: "Ticket closed and forgotten",
    care: "Concern recorded → patterns surface over time",
  },
  {
    dim: "Fit to your business",
    chatbot: "One generic bot",
    inbox: "Fixed fields",
    care: "AI name, tone, topics, branding — all yours",
  },
];

export default function CareDemoPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      {/* Header */}
      <header className="border-b border-default bg-base/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ELOSTATE — home">
            <LightbulbMark width={22} height={30} className="flex-shrink-0" />
            <span className="text-sm font-black tracking-tight text-primary">ELOSTATE</span>
            <span className="text-[10px] font-mono text-muted border-l border-default pl-2.5 ml-0.5">
              C.A.R.E
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <ThemeToggle />
            <a
              href="#walkthrough"
              className="text-secondary hover:text-primary transition-colors hidden sm:inline"
            >
              See it work
            </a>
            <a
              href={BOOKING_URL}
              className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Book a demo <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero — the thesis */}
      <section className="relative px-6 py-20 md:py-24 max-w-5xl mx-auto text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-start justify-center -z-10"
        >
          <div className="w-[600px] h-[600px] bulb-glow" />
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-4">
          C.A.R.E · Customer Assistance &amp; Response Engine
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-primary leading-[1.05] tracking-tight mb-6">
          AI answers in seconds.<br className="hidden md:inline" />{" "}
          <span className="text-brand">When a human takes over,<br className="hidden md:inline" /> they already know everything.</span>
        </h1>
        <p className="text-base md:text-lg text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
          Not a chatbot that deflects. Not a bare inbox that makes people
          repeat themselves. C.A.R.E is a diagnostic handoff — the AI
          handles what it can, then arms a real agent with the full story
          so every customer is met by someone who&apos;s already caught up.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="#walkthrough"
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Watch the walkthrough <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <a
            href="#adapts"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            How it adapts to you →
          </a>
        </div>

        <p className="text-[11px] text-muted mt-5 font-mono">
          Try the real Jeff — the chat bubble, bottom-right, is live.
        </p>
      </section>

      {/* Ask 1 — The best feature */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          The one feature that wins the room
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-5 max-w-3xl mx-auto leading-tight">
          The handoff is the whole game.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-3xl mx-auto text-center mb-12">
          Every support tool can answer easy questions. What breaks the
          experience is the moment a customer gets passed to a human — and
          has to start over. C.A.R.E is built around that moment: the AI
          hands off <em className="text-primary not-italic font-semibold">with the whole story attached</em>,
          and the agent it hands to is armed with tools that make them fast
          and consistent.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestFeature.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="text-xs md:text-sm text-secondary leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ask 3 — Click-by-click walkthrough */}
      <section id="walkthrough" className="px-6 py-16 max-w-5xl mx-auto scroll-mt-20">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          Click through it
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-5 max-w-3xl mx-auto leading-tight">
          Watch one conversation, end to end.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-8">
          A real late-night order problem, step by step — the customer&apos;s
          side on the left, the agent&apos;s side on the right. Drive it at
          your own pace.
        </p>

        <CareDemoWalkthrough />
      </section>

      {/* Ask 2 — Malleability */}
      <section id="adapts" className="px-6 py-16 max-w-5xl mx-auto scroll-mt-20">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          It bends to your business
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-5 max-w-3xl mx-auto leading-tight">
          The same engine, shaped to you.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-10">
          C.A.R.E isn&apos;t a fixed widget you adapt to — it&apos;s
          configured to your business. Flip one setting and the whole
          handoff reshapes. Everything from the AI&apos;s name to the
          topics to the branding is yours.
        </p>

        <CareDemoMalleability />
      </section>

      {/* Why a league of our own — compare / contrast */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
          Not on how — on why
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-10 max-w-3xl mx-auto leading-tight">
          Why we&apos;re a league of our own.
        </h2>

        <div className="glass-card p-2 md:p-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-default">
                <th className="text-[10px] uppercase tracking-wider text-muted font-semibold p-3"> </th>
                <th className="text-[11px] font-semibold text-secondary p-3">
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" aria-hidden /> A chatbot
                  </span>
                </th>
                <th className="text-[11px] font-semibold text-secondary p-3">
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" aria-hidden /> A support inbox
                  </span>
                </th>
                <th className="text-[11px] font-bold text-brand p-3">
                  <span className="flex items-center gap-1.5">
                    <LightbulbMark width={12} height={16} aria-hidden /> C.A.R.E
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.dim} className="border-b border-default/50 last:border-0">
                  <td className="text-[11px] font-semibold text-primary p-3 align-top whitespace-nowrap">
                    {r.dim}
                  </td>
                  <td className="text-[11px] text-muted p-3 align-top">
                    <span className="flex items-start gap-1.5">
                      <X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />
                      {r.chatbot}
                    </span>
                  </td>
                  <td className="text-[11px] text-muted p-3 align-top">
                    <span className="flex items-start gap-1.5">
                      <X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />
                      {r.inbox}
                    </span>
                  </td>
                  <td className="text-[11px] text-secondary p-3 align-top">
                    <span className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" aria-hidden />
                      <span className="text-primary">{r.care}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted italic text-center mt-6 max-w-2xl mx-auto">
          The difference isn&apos;t a longer feature list. It&apos;s that the
          hard moment — the handoff — is the thing we built the product
          around.
        </p>
      </section>

      {/* The honest note — same voice as the landing page */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="glass-card p-6 md:p-8 border border-ember-400/30 bg-ember-400/[0.03]">
          <p className="text-[10px] uppercase tracking-widest text-brand font-semibold mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> The honest part
          </p>
          {/* Body uses text-primary (not text-secondary): in light mode the
              text-secondary token rendered invisible in THIS ember-tinted
              glass-card box specifically (founder-reported 2026-07-22), while
              text-primary/text-brand render fine here. Root CSS mechanism not
              fully isolated; text-primary is the verified-readable fix and the
              honest statement warrants full contrast regardless. */}
          <p className="text-sm md:text-base text-primary leading-relaxed">
            The same AI brain that runs C.A.R.E also grades and learns —
            and we don&apos;t claim it&apos;s perfect on day one. It gets
            sharper about your business with every conversation, because
            every concern is captured, not thrown away. That compounding
            is the part a competitor can&apos;t copy — it&apos;s built from
            <em className="text-brand not-italic font-semibold"> your</em> history.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-primary leading-tight mb-4">
          See it on <span className="text-brand">your</span> support flow.
        </h2>
        <p className="text-sm md:text-base text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          Bring one real support conversation your team handled this week.
          We&apos;ll walk it through C.A.R.E — the answer, the handoff, the
          capture, the tools — and you decide whether that&apos;s the
          experience you want your customers to have.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href={BOOKING_URL}
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm"
          >
            Book a demo <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <a
            href="#walkthrough"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm"
          >
            <Repeat className="w-4 h-4" aria-hidden="true" /> Replay the walkthrough
          </a>
        </div>
        <p className="text-[11px] text-muted mt-5 font-mono flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3" aria-hidden /> Pilot-stage · onboarding a few companies at a time
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-default mt-6 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <LightbulbMark width={16} height={22} aria-hidden />
          <span className="text-xs font-black tracking-tight text-primary">ELOSTATE</span>
        </div>
        <p className="text-[10px] text-muted mb-2">
          C.A.R.E — Customer Assistance &amp; Response Engine · © {new Date().getFullYear()} ELOSTATE
        </p>
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted">
          <Link href="/" className="hover:text-primary underline">
            Home
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
    </div>
  );
}
