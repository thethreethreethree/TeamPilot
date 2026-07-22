"use client";

/**
 * /care/demo — the C.A.R.E interactive showroom (founder 2026-07-22 rebuild).
 *
 * Rebuilt from a flat linear slideshow into an INTERACTIVE showroom that demonstrates the six named
 * features actually working (founder directive: "showcase all our important features … WOW the customer").
 * Spec answered by the founder (AskUserQuestion): scripted-interactive · agent-workstation structure ·
 * the six features only. Deployed in-product at elostate.com/care/demo — NOT an artifact.
 *
 * The six features:
 *   - Jeff (AI first-responder) — the JeffLiveChat panel (talk to it).
 *   - Coach, Co-Pilot, Formulate, Summarize, Dissect — the CareShowroom agent-workstation, each run on
 *     ONE shared conversation (A16 composition), output shapes faithful to the real routes.
 *
 * GOVERNED (files read this session): AMD-006 four layers (L1 the components own structure + faithful
 * data; L2 every tool produces its result — verified by screenshot/interaction; L3 tools compose on one
 * thread; L4 UI theme-aware chrome + a deliberate fixed-dark "product console" for the workstation/Jeff —
 * a single-theme element per the design discipline, chosen for contrast-safety after the light-mode
 * text-secondary bug). §3.4: only the 7 verified books are cited; no feature overclaimed.
 *
 * The global "Jeff" widget (root layout) is NOT hidden here — a prospect can also try the real one
 * bottom-right. BOOKING_URL is a placeholder to fill before sending to prospects.
 */

import Link from "next/link";
import { ArrowRight, Repeat, X, Check, MousePointerClick } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LightbulbMark } from "@/components/brand/Logo";
import { CareShowroom } from "@/components/care/demo/CareShowroom";
import { CareAgentBenefits } from "@/components/care/demo/CareAgentBenefits";
import { JeffLiveChat } from "@/components/care/demo/JeffLiveChat";
import { CareHonestNote } from "@/components/care/demo/CareHonestNote";

// TODO(founder): replace with your real booking / contact link before sending to prospects.
const BOOKING_URL = "/login"; // → [your booking link]

const compareRows: { dim: string; chatbot: string; inbox: string; care: string }[] = [
  { dim: "After hours", chatbot: "Deflects to a FAQ", inbox: "Customer waits till morning", care: "Jeff answers in seconds, grounded in your product" },
  { dim: "When it can't help", chatbot: "Loops or guesses", inbox: "—", care: "Hands off honestly, in-thread, reliably" },
  { dim: "Writing the reply", chatbot: "—", inbox: "Agent on their own", care: "Co-Pilot drafts, Formulate shapes, Coach grades vs the books" },
  { dim: "Stepping into a thread", chatbot: "—", inbox: "Read it all from scratch", care: "Summarize catches you up; Dissect finds the real problem" },
  { dim: "Getting better over time", chatbot: "Static bot", inbox: "No feedback loop", care: "Every reply coached against 7 communication masterworks" },
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
            <span className="text-[10px] font-mono text-muted border-l border-default pl-2.5 ml-0.5">C.A.R.E</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <ThemeToggle />
            <a href="#workstation" className="text-secondary hover:text-primary transition-colors hidden sm:inline">
              See it work
            </a>
            <a href={BOOKING_URL} className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Book a demo <ArrowRight className="w-3 h-3" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      {/* Hero — tight, points straight at the interactive proof.
          overflow-hidden clips the decorative 600px glow below so it can't extend the page's
          horizontal scroll width on narrow viewports (mobile overflow bug, audit V1 2026-07-22).
          Scoped to the hero section, NOT the root — root overflow-x-hidden would make the root a
          scroll container and break the sticky header (§1.5 ripple-traced). */}
      <section className="relative overflow-hidden px-6 pt-16 pb-8 max-w-5xl mx-auto text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center -z-10">
          <div className="w-[600px] h-[600px] bulb-glow" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-4">
          C.A.R.E · Customer Assistance &amp; Response Engine
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-primary leading-[1.05] tracking-tight mb-5">
          Don&apos;t read about it.<br className="hidden md:inline" /> <span className="text-brand">Watch it work.</span>
        </h1>
        <p className="text-base md:text-lg text-secondary leading-relaxed max-w-2xl mx-auto mb-6">
          Below is a real support conversation. Run every C.A.R.E tool on it yourself — Coach, Co-Pilot,
          Formulate, Summarize, Dissect — and talk to Jeff, the AI that answers first. This is the actual
          product, not a slideshow.
        </p>
        <a
          href="#workstation"
          className="inline-flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm"
        >
          <MousePointerClick className="w-4 h-4" aria-hidden /> Try the tools
        </a>
      </section>

      {/* The workstation — the star */}
      <section id="workstation" className="px-6 py-10 max-w-5xl mx-auto scroll-mt-20">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">Five tools · one conversation</p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-6 max-w-3xl mx-auto leading-tight">
          The agent&apos;s side — every tool, live.
        </h2>
        <CareShowroom />
        <p className="text-[11px] text-muted text-center mt-3">
          Faithful to the real product&apos;s output — Coach cites verified communication books, Co-Pilot
          names its move, Dissect quotes the thread. Interactive, not a video.
        </p>
      </section>

      {/* What your agents actually get — the buyer's real question */}
      <CareAgentBenefits />

      {/* Jeff — the customer side */}
      <section className="px-6 py-10 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">The customer&apos;s side</p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-3 max-w-3xl mx-auto leading-tight">
          Talk to Jeff — the AI that answers first.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-6">
          Ask what a prospect would ask. Jeff answers instantly, grounded in the product — and when it hits
          something only a human should handle, it hands off honestly instead of guessing.
        </p>
        <JeffLiveChat />
      </section>

      {/* Why different */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">Not on how — on why</p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-8 max-w-3xl mx-auto leading-tight">
          Why we&apos;re a league of our own.
        </h2>
        {/* Desktop: comparison table. Hidden on mobile because a min-w-[640px] table forced the
            C.A.R.E column (the punchline) off-screen inside its scroll container — a prospect on a
            phone never saw it (audit V1 2026-07-22, verified by CDP render). */}
        <div className="glass-card p-4 overflow-x-auto hidden md:block">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-default">
                <th className="p-3"> </th>
                <th className="text-[11px] font-semibold text-secondary p-3">A chatbot</th>
                <th className="text-[11px] font-semibold text-secondary p-3">A support inbox</th>
                <th className="text-[11px] font-bold text-brand p-3">C.A.R.E</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.dim} className="border-b border-default/50 last:border-0">
                  <td className="text-[11px] font-semibold text-primary p-3 align-top whitespace-nowrap">{r.dim}</td>
                  <td className="text-[11px] text-muted p-3 align-top">
                    <span className="flex items-start gap-1.5"><X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />{r.chatbot}</span>
                  </td>
                  <td className="text-[11px] text-muted p-3 align-top">
                    <span className="flex items-start gap-1.5"><X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />{r.inbox}</span>
                  </td>
                  <td className="text-[11px] text-secondary p-3 align-top">
                    <span className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" aria-hidden /><span className="text-primary">{r.care}</span></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards from the same data, so the C.A.R.E answer is always on-screen and
            emphasized — no horizontal scroll needed. */}
        <div className="md:hidden flex flex-col gap-3">
          {compareRows.map((r) => (
            <div key={r.dim} className="glass-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-3">{r.dim}</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-500" aria-hidden />
                  <span className="text-xs text-muted"><span className="text-secondary font-medium">Chatbot:</span> {r.chatbot}</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-500" aria-hidden />
                  <span className="text-xs text-muted"><span className="text-secondary font-medium">Support inbox:</span> {r.inbox}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-ember-400/10 border border-ember-400/25 p-2.5 -mx-0.5">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" aria-hidden />
                  <span className="text-xs text-primary"><span className="text-brand font-bold">C.A.R.E:</span> {r.care}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Honest note — fixed-dark component (see CareHonestNote for why). */}
      <section className="px-6 py-8 max-w-4xl mx-auto">
        <CareHonestNote />
      </section>

      {/* CTA */}
      <section className="px-6 py-16 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-primary leading-tight mb-4">
          See it on <span className="text-brand">your</span> support flow.
        </h2>
        <p className="text-sm md:text-base text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          Bring one real support conversation your team handled this week. We&apos;ll run C.A.R.E on it live
          — the answer, the handoff, the tools — and you decide whether that&apos;s the experience you want
          your customers to have.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a href={BOOKING_URL} className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm">
            Book a demo <ArrowRight className="w-4 h-4" aria-hidden />
          </a>
          <a href="#workstation" className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm">
            <Repeat className="w-4 h-4" aria-hidden /> Run the tools again
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-default mt-6 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <LightbulbMark width={16} height={22} aria-hidden />
          <span className="text-xs font-black tracking-tight text-primary">ELOSTATE</span>
        </div>
        <p className="text-[10px] text-muted">C.A.R.E — Customer Assistance &amp; Response Engine · © {new Date().getFullYear()} ELOSTATE</p>
      </footer>
    </div>
  );
}
