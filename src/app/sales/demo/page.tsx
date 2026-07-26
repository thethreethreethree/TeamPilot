"use client";

/**
 * /sales/demo — the Sales Coach interactive showroom (founder 2026-07-22).
 *
 * Same logic as /care/demo, adapted to Sales Coach: hero → coaching console (SalesShowroom: five tools
 * on one real call) → rep-benefit story (SalesRepBenefits) → LIVE roleplay (SalesRoleplay, wired to
 * /api/sales/demo/roleplay) → why-different comparison → honest note → CTA.
 *
 * GOVERNED by AMD-006 four layers: L1 each piece owns its structure + faithful data; L2 the roleplay is
 * the REAL engine + the tool outputs map to shipped features; L3 the sections compose into one flowing
 * pitch (console → what it means → try it live → why us → book), every step leading onward; L4 theme-aware
 * chrome + a deliberate fixed-dark console. §3.4: only real, shipped Sales Coach features are shown.
 */

import Link from "next/link";
import { ArrowRight, Repeat, X, Check, MousePointerClick } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LightbulbMark } from "@/components/brand/Logo";
import { SalesShowroom } from "@/components/sales-coach/demo/SalesShowroom";
import { SalesRepBenefits } from "@/components/sales-coach/demo/SalesRepBenefits";
import { SalesRoleplay } from "@/components/sales-coach/demo/SalesRoleplay";
import { SalesHonestNote } from "@/components/sales-coach/demo/SalesHonestNote";

// Set NEXT_PUBLIC_BOOKING_URL in Vercel to your real booking / contact link (no code change needed);
// falls back to /login until then. Replace before sending the demo to prospects.
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "/login";

const compareRows: { dim: string; recordings: string; training: string; coach: string }[] = [
  { dim: "When you get coached", recordings: "Next week, if a manager watches", training: "Once a quarter, in a room", coach: "In the moment, on the call" },
  { dim: "What you get told", recordings: "—", training: "\"Be more consultative\"", coach: "Grade a real line vs 7 books; name the exact move" },
  { dim: "Finding the real objection", recordings: "Rewatch the whole call", training: "Generic scripts", coach: "Dissect quotes the line that turned it" },
  { dim: "Measuring a rep", recordings: "Gut feel", training: "—", coach: "Six skills /10 vs their own past, never a stack-rank" },
  { dim: "Getting better over time", recordings: "Static library", training: "Forgotten by Monday", coach: "Every call becomes the next call's lesson" },
];

export default function SalesDemoPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      {/* Header */}
      <header className="border-b border-default bg-base/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ELOSTATE — home">
            <LightbulbMark width={22} height={30} className="flex-shrink-0" />
            <span className="text-sm font-black tracking-tight text-primary">ELOSTATE</span>
            <span className="text-[10px] font-mono text-muted border-l border-default pl-2.5 ml-0.5">Sales Coach</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <ThemeToggle />
            <a href="#console" className="text-secondary hover:text-primary transition-colors hidden sm:inline">See it work</a>
            <a href={BOOKING_URL} className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Book a demo <ArrowRight className="w-3 h-3" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-8 max-w-5xl mx-auto text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center -z-10">
          <div className="w-[600px] h-[600px] bulb-glow" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-4">
          ELOSTATE · Sales Coach
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-primary leading-[1.05] tracking-tight mb-5">
          Coach the call.<br className="hidden md:inline" /> <span className="text-brand">Not the recording.</span>
        </h1>
        <p className="text-base md:text-lg text-secondary leading-relaxed max-w-2xl mx-auto mb-6">
          Below is a real sales call. Run every Sales Coach tool on it — the live cues, the debrief, Dissect,
          the graded line, the skill scores — then step into a live roleplay and get coached on your own pitch,
          in real time. This is the actual product, not a slideshow.
        </p>
        <a href="#console" className="inline-flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-3 rounded-lg transition-all shadow-glow text-sm">
          <MousePointerClick className="w-4 h-4" aria-hidden /> Try the tools
        </a>
      </section>

      {/* The console — the star */}
      <section id="console" className="px-6 py-10 max-w-5xl mx-auto scroll-mt-20">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">Five tools · one call</p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-6 max-w-3xl mx-auto leading-tight">
          The coach&apos;s side — every tool, on one real call.
        </h2>
        <SalesShowroom />
        <p className="text-[11px] text-muted text-center mt-3">
          Faithful to the real product&apos;s output — cues fire mid-call, the debrief names one focus, the
          Coach grades against verified sales books, Dissect quotes the moment it turned.
        </p>
      </section>

      {/* What your reps get */}
      <SalesRepBenefits />

      {/* Live roleplay — the customer side of a sales call */}
      <section className="px-6 py-10 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">Now you try</p>
        <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-3 max-w-3xl mx-auto leading-tight">
          Pitch a live prospect — and get coached as you go.
        </h2>
        <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-6">
          You&apos;re the salesperson. Dana is a real, skeptical prospect running on the live engine — and a
          coach cue lands on each line you send. Try to earn the meeting.
        </p>
        <SalesRoleplay />
      </section>

      {/* Why different */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">Not on how — on why</p>
        <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-8 max-w-3xl mx-auto leading-tight">
          Why we&apos;re a league of our own.
        </h2>
        {/* Desktop table */}
        <div className="glass-card p-4 overflow-x-auto hidden md:block">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-default">
                <th className="p-3"> </th>
                <th className="text-[11px] font-semibold text-secondary p-3">Call recordings</th>
                <th className="text-[11px] font-semibold text-secondary p-3">Sales training</th>
                <th className="text-[11px] font-bold text-brand p-3">Sales Coach</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.dim} className="border-b border-default/50 last:border-0">
                  <td className="text-[11px] font-semibold text-primary p-3 align-top whitespace-nowrap">{r.dim}</td>
                  <td className="text-[11px] text-muted p-3 align-top"><span className="flex items-start gap-1.5"><X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />{r.recordings}</span></td>
                  <td className="text-[11px] text-muted p-3 align-top"><span className="flex items-start gap-1.5"><X className="w-3 h-3 mt-0.5 shrink-0 text-ink-500" aria-hidden />{r.training}</span></td>
                  <td className="text-[11px] text-secondary p-3 align-top"><span className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" aria-hidden /><span className="text-primary">{r.coach}</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden flex flex-col gap-3">
          {compareRows.map((r) => (
            <div key={r.dim} className="glass-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-3">{r.dim}</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2"><X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-500" aria-hidden /><span className="text-xs text-muted"><span className="text-secondary font-medium">Call recordings:</span> {r.recordings}</span></div>
                <div className="flex items-start gap-2"><X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-500" aria-hidden /><span className="text-xs text-muted"><span className="text-secondary font-medium">Sales training:</span> {r.training}</span></div>
                <div className="flex items-start gap-2 rounded-lg bg-ember-400/10 border border-ember-400/25 p-2.5 -mx-0.5"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" aria-hidden /><span className="text-xs text-primary"><span className="text-brand font-bold">Sales Coach:</span> {r.coach}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Honest note */}
      <section className="px-6 py-8 max-w-4xl mx-auto">
        <SalesHonestNote />
      </section>

      {/* CTA */}
      <section id="book" className="px-6 py-16 max-w-4xl mx-auto text-center scroll-mt-20">
        <h2 className="text-3xl md:text-5xl font-bold text-primary leading-tight mb-4">
          See it on <span className="text-brand">your</span> calls.
        </h2>
        <p className="text-sm md:text-base text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
          Bring one real call your team ran this week. We&apos;ll run Sales Coach on it live — the cues, the
          debrief, the graded lines — and you decide whether that&apos;s how you want every rep coached.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a href={BOOKING_URL} className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-3 rounded-lg transition-all shadow-glow text-sm">
            Book a demo <ArrowRight className="w-4 h-4" aria-hidden />
          </a>
          <a href="#console" className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-3 rounded-lg transition-all text-sm">
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
        <p className="text-[10px] text-muted">Sales Coach · live coaching + growth reviews · © {new Date().getFullYear()} ELOSTATE</p>
      </footer>
    </div>
  );
}
