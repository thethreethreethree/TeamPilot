"use client";

import TopBar from "@/components/layout/TopBar";
import { Library } from "lucide-react";

/**
 * Strategy Library — placeholder (founder 2026-07-04 PWA home card #4).
 * Phase 2 will make this a read-only view of the Sales Knowledge Base +
 * saved corpus + an aggregation of "Correct line" moves from past reviews
 * ("top-performing correct lines"). Honest "coming soon" until then (§3.4).
 */
export default function SalesCoachStrategyPage() {
  return (
    <>
      <TopBar title="Strategy Library" subtitle="Correct lines & sales strategies" />
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center text-center px-6 bg-base">
        <div className="w-14 h-14 rounded-2xl border border-ember-400/40 bg-white/[0.02] flex items-center justify-center mb-4">
          <Library className="w-7 h-7 text-brand" strokeWidth={1.5} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-primary">Strategy Library</h2>
        <p className="text-xs text-secondary max-w-xs mt-2 leading-relaxed">
          Find top-performing correct lines and sales strategies — the best
          moves pulled from your reviews plus your team&apos;s methodology.
        </p>
        <p className="text-[11px] text-brand mt-3 font-semibold">Coming soon</p>
      </div>
    </>
  );
}
