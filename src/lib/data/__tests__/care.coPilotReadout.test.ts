import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchCoPilotValueReadout is the §3.5 "does Co-Pilot improve outcomes?" measure
 * — it buckets conversations into co-pilot-USED vs NOT cohorts and compares
 * durability (held / reopened). This pins the JS aggregation logic (bucketing +
 * per-cohort outcome counts + held-rate), which is the part that isn't SQL.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchCoPilotValueReadout } from "../care";

describe("fetchCoPilotValueReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("splits conversations into cohorts and counts durability per cohort", async () => {
    // A + B used co-pilot; C did not. A,C held; B reopened.
    const checks = {
      data: [
        { conversation_id: "A", outcome: "held" },
        { conversation_id: "B", outcome: "reopened" },
        { conversation_id: "C", outcome: "held" },
      ],
    };
    const messages = {
      data: [
        { conversation_id: "A", co_pilot_invoked: true },
        { conversation_id: "B", co_pilot_invoked: true },
        { conversation_id: "C", co_pilot_invoked: false },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: checks, support_messages: messages },
        calls
      ) as never
    );

    const out = (await fetchCoPilotValueReadout({ companyId: "co1" })) as {
      cohorts: {
        coPilotUsed: Record<string, number | null>;
        coPilotNotUsed: Record<string, number | null>;
      };
    };

    expect(out.cohorts.coPilotUsed).toMatchObject({
      conversationCount: 2,
      durabilityHeld: 1, // A
      durabilityReopened: 1, // B
      durabilityInconclusive: 0,
      durabilityHeldRate: 0.5, // 1 held of 2
    });
    expect(out.cohorts.coPilotNotUsed).toMatchObject({
      conversationCount: 1,
      durabilityHeld: 1, // C
      durabilityReopened: 0,
      durabilityHeldRate: 1, // 1 of 1
    });
  });

  it("returns empty cohorts (heldRate null) when there are no durability checks", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks: { data: [] } }, calls) as never
    );
    const out = (await fetchCoPilotValueReadout({ companyId: "co1" })) as {
      cohorts: { coPilotUsed: Record<string, number | null> };
    };
    expect(out.cohorts.coPilotUsed).toMatchObject({
      conversationCount: 0,
      durabilityHeldRate: null, // honest: no data, not a fabricated 0
    });
  });
});
