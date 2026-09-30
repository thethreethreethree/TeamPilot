import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "SCORED" MEANS THE RUBRIC (founder, picker 2026-09-30).
 *
 * The Coach Assessment board showed a rep with "18 scored calls" beside "Recordings (0)". Both said
 * "scored", but they count different things: the coaching grade counts every call the coach graded,
 * and Recordings counts pitches scored on the AT&T rubric. They never match, even once every recording
 * is scored. The founder chose "coached calls" for the grade's count, so "scored" means one thing.
 *
 * A source check rather than a render: the badges fetch before they render, and this rule is about
 * the words a surface may use, not about what the fetch returns.
 */
const surfaces = [
  "src/components/sales-coach/AgentGradeBadge.tsx",
  "src/components/sales-coach/AgentEloBadge.tsx",
  "src/app/dashboard/sales-coach/analytics/page.tsx",
  // Added 2026-09-30 (founder, second picker): the points surfaces count coach-graded sessions too.
  "src/lib/coach/gamification/weeklyDigest.ts",
  "src/components/sales-coach/Scoreboard.tsx",
];

/** Rendered text only: comments may still discuss the old wording. */
const rendered = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("coach-graded counts say 'coached', never 'scored'", () => {
  for (const file of surfaces) {
    it(file, () => {
      const src = rendered(readFileSync(join(process.cwd(), file), "utf8"));
      expect(src).not.toMatch(/scored (call|pitch|session)/i);
    });
  }

  it("the badges still name the count", () => {
    for (const file of surfaces.slice(0, 2)) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).toMatch(/coached call/);
    }
  });
});
