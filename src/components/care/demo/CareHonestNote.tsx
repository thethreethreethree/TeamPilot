"use client";

/**
 * The "honest part" note on /care/demo — a DELIBERATE fixed-dark card (founder 2026-07-22).
 *
 * Rendered with fixed ink/zinc colors, not theme tokens, for two reasons:
 *  1. Contrast-safety: as a theme-aware glass-card this note rendered INVISIBLE in light mode — empirically
 *     text-primary/text-secondary came out near-white while text-brand rendered fine, in this box only
 *     (founder-reported 2026-07-22). ROOT CAUSE IS NOT ISOLATED. A likely-looking hypothesis ("a nested
 *     dark-theme context") was investigated and RULED OUT — nothing in the code sets data-theme/
 *     color-scheme/token overrides below the root (only layout.tsx on <html>). The true mechanism
 *     (probably a CSS build/specificity artifact of glass-card + bg-ember-400/[0.03]) needs live
 *     computed-style inspection to confirm. Fixed colors are the VERIFIED-legible workaround, not a
 *     root-cause fix. Open Layer-4 finding (F4).
 *  2. It matches the fixed-dark "product console" aesthetic of the workstation/Jeff above it.
 *
 * Split into its own component so the deliberate fixed-dark palette reads as an intentional dark surface
 * (and doesn't flag as a stray theme-leak inside the otherwise theme-aware page). §3.4: the note is the
 * honesty statement — it must be legible, which is the whole point of the fixed palette.
 */

import { ShieldCheck } from "lucide-react";

export function CareHonestNote() {
  return (
    <div className="rounded-2xl p-6 md:p-8 border border-ember-400/30 bg-ink-900">
      <p className="text-[10px] uppercase tracking-widest text-ember-300 font-semibold mb-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> The honest part
      </p>
      <p className="text-sm md:text-base text-zinc-200 leading-relaxed">
        The same AI brain that runs C.A.R.E also grades and learns — and we don&apos;t claim it&apos;s
        perfect on day one. It gets sharper about your business with every conversation, because every
        concern is captured, not thrown away. That compounding is the part a competitor can&apos;t copy —
        it&apos;s built from <em className="text-ember-300 not-italic font-semibold">your</em> history.
      </p>
    </div>
  );
}
