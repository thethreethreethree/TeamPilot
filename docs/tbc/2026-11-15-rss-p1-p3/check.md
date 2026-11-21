# CHECK - RSS Phase 1 and Phase 3 (partial)

## Commands

None. No Node on this machine; `npm run check` was not run, nor any part of it. Migrations 0275 and 0276 are not
applied (Supabase suspended). Test expectations were worked by hand; gate rules (rls, writer, reachability,
invariants 14/18/26/29/34/36) were read and the files written to them.

The full `npm run check` output must be appended below before commit.

## Findings

### A phone call would have been described to the AI as a video call

class: a closed set re-typed as a literal union in many places
sweep: `grep -rn '"in_person" | "video"\|context === "in_person" ?' src`
severity: medium

13 files and 8 prompts. All now read src/lib/coach/sessionContext.ts.

### The plan's rubric index names a column that does not exist

class: a plan written without the live schema
sweep: `grep -n "is_active" supabase/migrations/0252_pitch_score_system.sql`
severity: medium

rubric_config uses is_active; the scaffold's index used `active`. Not applied here (the channel column ships with
the scorer change); noted in 0276's header for then.

### Required outcome conflicts with a recorded founder ruling

class: a plan requirement against a live-repo decision
sweep: `grep -n "SKIPPABLE\|skippable" "src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx"`
severity: medium

Not built; founder decision.
