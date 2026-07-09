import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * The brain learning cycle must gather ALL THREE measured durability
 * consequences as learning inputs — held (success), reopened (failure), and
 * partial (refine) — per §1.1 ("errors, abandoned approaches, dead ends are
 * assets equal to successes") and the §A26 sweep to the boundary. 'unknown' is
 * NOT a measured consequence and must never be pulled. This pins the three-way
 * split (added 2026-07-09 alongside migration 0100's resolutions loop): each
 * durability lands in its own bucket, the mapping carries the joined problem
 * title, and the queries target exactly held/reopened/partial.
 *
 * Seam: gatherEvidence is internal, but runLearningCycle returns the gathered
 * `evidence` on every path. The LLM step is irrelevant to gathering, so we mock
 * llmCall to return empty arrays — the cycle runs its clean success path (no
 * record_brain_learning RPCs fire for empty arrays) and returns `evidence`.
 *
 * The mock keys canned results by TABLE, and `resolutions` is queried three
 * times in order (held, reopened, partial); a sequence FUNCTION hands each
 * successive .from("resolutions") its own rows (see _supabaseMock design note).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn().mockResolvedValue({
    text: '{"summary":"t","validated_methods":[],"disabled_suggestions":[],"known_patterns":[]}',
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { runLearningCycle } from "../learn";

function resRow(id: string) {
  return {
    id,
    action_taken: `action-${id}`,
    reasoning: `reasoning-${id}`,
    observed_outcome: `outcome-${id}`,
    problems: { title: `problem-${id}` },
  };
}

function mockWithResolutionSequence(
  seq: Array<{ data: unknown[] }>,
  calls: Array<[string, unknown[]]>
) {
  let i = 0;
  return makeSupabaseClient(
    {
      resolutions: () => seq[i++] ?? { data: [] },
      problems: { data: [] },
      signals: { data: [] },
    },
    calls
  ) as never;
}

describe("runLearningCycle evidence — §1.1 learn from all measured consequences", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("pulls held, reopened AND partial into distinct buckets; targets exactly those durabilities (unknown excluded)", async () => {
    // .from("resolutions") fires 3x in order: held, reopened, partial.
    vi.mocked(createClient).mockResolvedValue(
      mockWithResolutionSequence(
        [
          { data: [resRow("H1"), resRow("H2")] }, // held
          { data: [resRow("R1")] }, // reopened
          { data: [resRow("P1"), resRow("P2")] }, // partial
        ],
        calls
      )
    );

    const result = await runLearningCycle("co1");

    expect(result.evidence.heldResolutions.map((r) => r.id)).toEqual(["H1", "H2"]);
    expect(result.evidence.reopenedResolutions.map((r) => r.id)).toEqual(["R1"]);
    expect(result.evidence.partialResolutions.map((r) => r.id)).toEqual(["P1", "P2"]);
    // mapping carries the joined problem title through, not just the id
    expect(result.evidence.heldResolutions[0]!.problem_title).toBe("problem-H1");

    // The three resolution pulls targeted the right durability filters in order,
    // and NONE targeted 'unknown' (the unmeasured value must stay out).
    const durabilityFilters = calls
      .filter(([m, a]) => m === "eq" && (a as unknown[])[0] === "durability")
      .map(([, a]) => (a as unknown[])[1]);
    expect(durabilityFilters).toEqual(["held", "reopened", "partial"]);
    expect(durabilityFilters).not.toContain("unknown");
  });

  it("runs the cycle when ONLY reopened resolutions exist (a struggling team is NOT 'Brain unchanged')", async () => {
    // Before the §1.1 fix, evidence with no held/dismissed/signals short-
    // circuited to "Brain unchanged" — blind precisely to a team whose only
    // recent measured activity was failed fixes. reopened/partial now keep the
    // cycle alive so those failures are learned from.
    vi.mocked(createClient).mockResolvedValue(
      mockWithResolutionSequence(
        [
          { data: [] }, // held: none
          { data: [resRow("R1")] }, // reopened
          { data: [] }, // partial: none
        ],
        calls
      )
    );

    const result = await runLearningCycle("co1");

    expect(result.summary).not.toBe("No new validated activity. Brain unchanged.");
    expect(result.evidence.reopenedResolutions.map((r) => r.id)).toEqual(["R1"]);
  });
});
