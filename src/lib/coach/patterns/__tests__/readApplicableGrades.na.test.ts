import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { readApplicableGrades } from "../readPatterns";

/** 0331: an item a manager marked "Doesn't apply" did not apply on that pitch, so it is not part of the pattern history. */
describe("readApplicableGrades — N/A", () => {
  it("skips N/A rows; keeps hits and misses", async () => {
    const parent = { rep_id: "r", recorded_at: "2026-11-20T10:00:00Z", channel: "in_person" };
    const rows = [
      { element_id: "intro.trucks", grade: "missed", points: 0, pitch_id: "p1", pitch_scores_by_channel: parent },
      { element_id: "intro.trucks", grade: "na", points: 0, pitch_id: "p2", pitch_scores_by_channel: parent },
      { element_id: "intro.trucks", grade: "hit", points: 3, pitch_id: "p3", pitch_scores_by_channel: parent },
    ];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: rows, error: null }));
    const out = await readApplicableGrades({ repId: "r" }, { from: () => q } as never);
    expect(out.get("intro.trucks")!.map((g) => g.pitchId)).toEqual(["p1", "p3"]);
  });
});
