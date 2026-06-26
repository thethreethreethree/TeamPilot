"use client";

import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Bootcamp — the team's training hub (founder request 2026-06-26).
 *
 * Learning + training materials for specific features/fields of the
 * System. Each entry is a focused training area; this hub lists them
 * and routes into each. The first area is Master Sales Mind.
 *
 * Structure note: TRAINING_AREAS is a plain list so new areas are a
 * one-line addition. The per-area CONTENT model (static vs. lessons
 * vs. data-driven) is intentionally NOT decided here — each area's own
 * page owns its content. See master-sales-mind/page.tsx.
 */

type TrainingArea = {
  slug: string;
  title: string;
  blurb: string;
};

const TRAINING_AREAS: TrainingArea[] = [
  {
    slug: "master-sales-mind",
    title: "Master Sales Mind",
    blurb:
      "Training for the sales field — the mindset, methods, and language of effective selling within the System.",
  },
];

export default function BootcampPage() {
  const companyName = useCompanyName();

  return (
    <>
      <TopBar
        title="Bootcamp"
        subtitle={`${companyName ?? "Your team"} · training tracks for specific fields`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full">
        <LearningHint
          as="block"
          category="Bootcamp"
          title="Why Bootcamp exists"
          whatItIs="Learning and training materials for specific features and fields of the System, organized into focused training areas. The first is Master Sales Mind."
          why="Capability transferred only ad hoc doesn't compound and evaporates with turnover. A dedicated, returnable training surface makes building capability a deliberate act and gives new members somewhere to start."
          how="Pick a training area below and work through its materials. New areas are added as the team's training needs grow."
          principle="Capability built deliberately compounds; capability left to osmosis evaporates."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRAINING_AREAS.map((area) => (
              <Link
                key={area.slug}
                href={`/dashboard/bootcamp/${area.slug}`}
                className="group rounded-xl border border-default hover:border-strong bg-white/[0.01] p-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-ember-400/10 border border-ember-400/30 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-brand" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-primary">
                        {area.title}
                      </h3>
                      <ArrowRight
                        className="w-3.5 h-3.5 text-muted group-hover:text-brand transition-colors"
                        aria-hidden
                      />
                    </div>
                    <p className="text-xs text-secondary leading-relaxed mt-1">
                      {area.blurb}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </LearningHint>
      </div>
    </>
  );
}
