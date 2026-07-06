import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchCoachRubricReadout is the §A2 "measure the reframe against the
 * alternative" readout — it splits durability-checked conversations into
 * v6 / v5 / ungraded cohorts by the coach fields on their agent messages, then
 * compares durability. The distinct logic worth pinning is the classification
 * PRECEDENCE: coach_counts => v6 (wins regardless), else coach_grade => v5, else
 * ungraded — so a conversation carrying both a v5 and a v6 message is v6.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchCoachRubricReadout } from "../care";

describe("fetchCoachRubricReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("classifies by coach-field precedence and aggregates durability per cohort", async () => {
    const checks = {
      data: [
        { conversation_id: "V6", outcome: "held" },
        { conversation_id: "V5", outcome: "reopened" },
        { conversation_id: "UN", outcome: "held" },
        { conversation_id: "MIX", outcome: "held" },
      ],
    };
    const messages = {
      data: [
        { conversation_id: "V6", coach_counts: { a: 1 }, coach_grade: null },
        { conversation_id: "V5", coach_counts: null, coach_grade: "B" },
        { conversation_id: "UN", coach_counts: null, coach_grade: null },
        // MIX has both a v5-shaped and a v6-shaped message → v6 must win.
        { conversation_id: "MIX", coach_counts: null, coach_grade: "A" },
        { conversation_id: "MIX", coach_counts: { a: 2 }, coach_grade: null },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: checks, support_messages: messages },
        calls
      ) as never
    );

    const out = (await fetchCoachRubricReadout({ companyId: "co1" })) as {
      cohorts: Record<"v6" | "v5" | "ungraded", Record<string, number | null>>;
    };

    expect(out.cohorts.v6).toMatchObject({
      conversationCount: 2, // V6 + MIX (v6 wins)
      durabilityHeld: 2,
      durabilityHeldRate: 1,
    });
    expect(out.cohorts.v5).toMatchObject({
      conversationCount: 1, // V5
      durabilityReopened: 1,
      durabilityHeld: 0,
      durabilityHeldRate: 0,
    });
    expect(out.cohorts.ungraded).toMatchObject({
      conversationCount: 1, // UN
      durabilityHeld: 1,
      durabilityHeldRate: 1,
    });
  });

  it("returns three empty cohorts (null rates) when there are no checks", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks: { data: [] } }, calls) as never
    );
    const out = (await fetchCoachRubricReadout({ companyId: "co1" })) as {
      cohorts: Record<"v6" | "v5" | "ungraded", Record<string, number | null>>;
    };
    for (const b of ["v6", "v5", "ungraded"] as const) {
      expect(out.cohorts[b]).toMatchObject({
        conversationCount: 0,
        durabilityHeldRate: null,
      });
    }
  });
});
