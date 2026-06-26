"use client";

import Link from "next/link";
import { ArrowLeft, GraduationCap, Hourglass } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Bootcamp → Master Sales Mind (founder request 2026-06-26).
 *
 * The first Bootcamp training area: the sales field. The CONTENT model
 * (static materials, structured lessons/modules, or data-driven) is
 * NOT yet decided — surfaced to the founder. This page is the
 * content-agnostic shell: a clear intro + an honest "materials coming"
 * state that names what will live here, so a click never dead-ends
 * into a blank page (AMD-006 §1.5.1 — continuity / no empty dead end).
 */

export default function MasterSalesMindPage() {
  const companyName = useCompanyName();

  return (
    <>
      <TopBar
        title="Master Sales Mind"
        subtitle={`${companyName ?? "Your team"} · Bootcamp`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        <Link
          href="/dashboard/bootcamp"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Back to Bootcamp
        </Link>

        <LearningHint
          as="block"
          category="Bootcamp · Master Sales Mind"
          title="What this training area is"
          whatItIs="The sales-field training track: the mindset, methods, and language of effective selling within the System."
          why="Sales capability is high-leverage and very transferable when it's taught deliberately. Master Sales Mind is the returnable place that capability lives, instead of being scattered across calls and chats."
          how="Work through the materials below. (They're being prepared — the structure is being confirmed with the founder before content is added.)"
          principle="A field worth selling in is a field worth training in, on purpose."
        >
          <div className="flex items-start gap-3 rounded-xl border border-default bg-white/[0.01] p-4">
            <div className="w-9 h-9 rounded-lg bg-ember-400/10 border border-ember-400/30 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-brand" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-primary mb-1">
                Master Sales Mind
              </h3>
              <p className="text-xs text-secondary leading-relaxed">
                This training area is set up and reachable. Its materials
                are being prepared — the content structure (static
                materials, structured lessons, or a data-driven course) is
                being confirmed before anything is added, so it's built
                right the first time.
              </p>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted mt-2.5 rounded-md border border-default px-2 py-1">
                <Hourglass className="w-3 h-3" aria-hidden />
                Materials coming
              </div>
            </div>
          </div>
        </LearningHint>
      </div>
    </>
  );
}
