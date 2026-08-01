import { describe, it, expect } from "vitest";
import type { CoachCountsValue } from "@/lib/data/care";
import type { CoachCounts } from "@/lib/care/grader";

/**
 * CoachCountsValue (data layer, care.ts) is a hand-kept mirror of CoachCounts (grader.ts),
 * duplicated so the data layer doesn't cross-import server-only grader code. care.ts says "Shape
 * mirrors src/lib/care/grader.ts CoachCounts" — enforced until now only by that comment. If the
 * two shapes drift, coach-count data flowing between the grader and the data layer mismatches.
 *
 * This is a COMPILE-TIME guard: the bidirectional assignments below fail `tsc` if the shapes
 * diverge, so `npm run check` (typecheck) catches the drift. `import type` is elided at runtime,
 * so referencing the server-only grader type pulls in NO server-only runtime code.
 */
// If either line stops compiling, CoachCountsValue and CoachCounts have drifted — reconcile them.
const _valueIsCounts: CoachCounts = null as unknown as CoachCountsValue;
const _countsIsValue: CoachCountsValue = null as unknown as CoachCounts;
void _valueIsCounts;
void _countsIsValue;

describe("CoachCountsValue mirrors grader CoachCounts", () => {
  it("compiles — the two coach-count shapes are structurally identical (assignable both ways)", () => {
    // The real guard is the compile-time bidirectional assignability above; this keeps the file a
    // runnable test so it appears in the suite and its typecheck is exercised by `npm run check`.
    expect(true).toBe(true);
  });
});
