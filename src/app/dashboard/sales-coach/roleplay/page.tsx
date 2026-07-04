"use client";

import TopBar from "@/components/layout/TopBar";
import { Target } from "lucide-react";

/**
 * Roleplay Practice — placeholder (founder 2026-07-04 PWA home card #3).
 * The real feature (an AI plays the prospect, the rep pitches, it scores +
 * reviews like a live call) is Phase 3. Honest "coming soon" until then
 * (§3.4 — no fake feature).
 */
export default function SalesCoachRoleplayPage() {
  return (
    <>
      <TopBar title="Roleplay Practice" subtitle="Simulated pitches" />
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center text-center px-6 bg-base">
        <div className="w-14 h-14 rounded-2xl border border-ember-400/40 bg-white/[0.02] flex items-center justify-center mb-4">
          <Target className="w-7 h-7 text-brand" strokeWidth={1.5} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-primary">Roleplay Practice</h2>
        <p className="text-xs text-secondary max-w-xs mt-2 leading-relaxed">
          Build your skills with simulated pitches — an AI plays the prospect,
          you pitch, and you get scored and reviewed like a real call.
        </p>
        <p className="text-[11px] text-brand mt-3 font-semibold">Coming soon</p>
      </div>
    </>
  );
}
