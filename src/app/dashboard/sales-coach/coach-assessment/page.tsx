"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { UnscoredBacklog } from "@/components/sales-coach/UnscoredBacklog";
import { ScoringRubricSheet } from "@/components/sales-coach/ScoringRubricSheet";
import { DisputeQueue } from "@/components/sales-coach/DisputeQueue";
import { CoachAssessmentBoard } from "@/components/sales-coach/CoachAssessmentBoard";

/**
 * Coach Assessment — rebuilt to the 2026-09-19 manager board (guide Step 3).
 *
 * REPLACED 2026-09-22, on the founder's ruling: *"rebuild the page, keep ELO inside rep detail."*
 * What was here was 680 lines headed by the Sales ELO Rating, "How the team is growing" and
 * per-rep coaching cards. The guide says the new board *"replaces the current Coach Assessment
 * layout"* and, in the same breath, that *"the existing coaching grade and notes stay unranked"*.
 *
 * NOTHING WAS DELETED. Every piece of the old page has a home:
 *
 *   · Sales ELO Rating → `AgentEloBadge` in the reps table and in rep detail. It stops being the
 *     page's headline and becomes one rep's attribute, which is where the board draws it.
 *   · Doing well / Coaching focus → the rep detail Overview panel, read from the same
 *     `/coach-assessment` route that has always owned them.
 *   · Skill scores + process breakdown → `RepSkillGrades`, extracted to its own component and
 *     rendered in rep detail. Moved, not rewritten: a second reading of the same six /10 scores
 *     is the duplicate this codebase keeps finding.
 *   · "Generate missing" → the Needs-your-attention section, which the guide explicitly says to
 *     keep it in.
 *   · Door metrics → the reps table's Doors / Pres. / Sold columns and the rep's KPI tiles.
 *
 * WHAT STAYS AT THIS LEVEL rather than moving into the board:
 *
 *   · `DisputeQueue`, above everything. A rep who says the AI got their pitch wrong is the one
 *     item on this screen where somebody is already waiting on a reply. It renders its own empty
 *     state, so it costs nothing on a quiet week — and the board deliberately does NOT summarise
 *     it, because two counts of one thing on one page is how a number starts disagreeing with
 *     itself.
 *   · The Scoring rubric button, which opens the same read-only sheet the rep boards open. One
 *     rubric, rendered from one config, so neither copy can go stale.
 */
export default function CoachAssessmentPage() {
  const [rubricOpen, setRubricOpen] = useState(false);

  return (
    <>
      <TopBar title="Coach Assessment" subtitle="How the team is pitching" />

      <div className="px-4 md:px-8 pt-3 w-full flex justify-end">
        <button
          type="button"
          onClick={() => setRubricOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:border-strong transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-brand" aria-hidden />
          Scoring rubric
        </button>
      </div>
      {rubricOpen && <ScoringRubricSheet onClose={() => setRubricOpen(false)} />}

      <div className="flex-1 overflow-y-auto bg-base">
        {/*
          ABOVE the dispute queue and above the board, because it explains why the board might be
          empty. A manager who opens this page to blank cards needs the reason before the cards,
          not underneath them — that ordering is the whole difference between "this product is
          broken" and "this product is waiting on one click".
        */}
        <div className="px-4 md:px-8 pt-4">
          <UnscoredBacklog />
        </div>
        <div className="px-4 md:px-8 pt-4">
          <DisputeQueue />
        </div>
        <CoachAssessmentBoard />
      </div>
    </>
  );
}
