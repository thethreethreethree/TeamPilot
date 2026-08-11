import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Guards that the KPI routes read their usage-growth tables through `fetchAllPaged`, not a bare unbounded
 * `.select()` (PostgREST silently caps those at 1000 rows). The truncation silently corrupted the Reliance
 * Reduction HEADLINE metric — transcript_segments crosses 1000 at ~25-30 coached sessions, so most active reps
 * saw a metric computed over the wrong session set (audit 2026-08-12, founder-authorized fix). The paging
 * BEHAVIOUR itself is proven in paginate.test.ts; this locks that the routes actually USE it, so a refactor
 * can't silently revert any of these seven reads to unbounded. Source-substring form (these are integration
 * route handlers; a behavioural pagination test would need a range-aware fake of the whole supabase chain).
 */
const ROOT = process.cwd();
const ME = readFileSync(join(ROOT, "src", "app", "api", "coach", "kpi", "me", "route.ts"), "utf-8");
const TEAM = readFileSync(join(ROOT, "src", "app", "api", "coach", "kpi", "team", "route.ts"), "utf-8");

/** A read is "paged" when its table name appears inside a fetchAllPaged(...) call that also ranges. If any of
 *  these reads is reverted to a bare unbounded `.select().in()`, its table no longer sits inside a
 *  fetchAllPaged(...).range(...) window and this returns false — that IS the regression guard. */
const pagedRead = (src: string, table: string) =>
  new RegExp(`fetchAllPaged\\([\\s\\S]{0,400}\\.from\\("${table}"\\)[\\s\\S]{0,300}\\.range\\(`).test(src);

describe("KPI routes page their usage-growth reads (no 1000-row truncation)", () => {
  it("/me pages after_pitch_summaries, coaching_cues, coaching_cue_outcomes, and coaching_transcript_segments", () => {
    for (const t of [
      "after_pitch_summaries",
      "coaching_cues",
      "coaching_cue_outcomes",
      "coaching_transcript_segments",
    ]) {
      expect(pagedRead(ME, t), `me: ${t} must be read via fetchAllPaged`).toBe(true);
    }
  });

  it("/team pages coaching_cues, coaching_transcript_segments, and after_pitch_summaries", () => {
    for (const t of ["coaching_cues", "coaching_transcript_segments", "after_pitch_summaries"]) {
      expect(pagedRead(TEAM, t), `team: ${t} must be read via fetchAllPaged`).toBe(true);
    }
  });

  it("orders each paged read by the unique id PK (correct range pagination)", () => {
    // fetchAllPaged's range paging needs a unique, stable sort key; all four tables have a uuid `id` PK.
    expect(/coaching_transcript_segments"\)[\s\S]{0,120}\.order\("id"\)/.test(ME)).toBe(true);
    expect(/coaching_transcript_segments"\)[\s\S]{0,120}\.order\("id"\)/.test(TEAM)).toBe(true);
  });
});
