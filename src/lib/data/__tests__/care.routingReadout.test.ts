import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchRoutingReadout is the §3.5 "does the routing METHOD change outcomes?" measure — it buckets
 * durability-checked conversations by `routing_method` into autoRouted / manualClaim / unrouted cohorts and
 * compares durability. This pins the JS aggregation: the method→cohort mapping (incl. the two manual variants
 * `manual_claim` + `manual_assign` both landing in manualClaim, and null/unknown → unrouted), the per-cohort
 * outcome counts, and the held-rate. (Coverage gap found alongside the voice readout.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchRoutingReadout } from "../care";

describe("fetchRoutingReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("maps routing_method to cohorts (both manual variants → manualClaim, null → unrouted) and counts durability", async () => {
    const checks = {
      data: [
        { conversation_id: "A", outcome: "held" }, // auto
        { conversation_id: "B", outcome: "reopened" }, // manual_claim
        { conversation_id: "C", outcome: "held" }, // null → unrouted
        { conversation_id: "D", outcome: "held" }, // auto
        { conversation_id: "E", outcome: "inconclusive" }, // manual_assign → manualClaim
      ],
    };
    const convs = {
      data: [
        { id: "A", routing_method: "auto_least_loaded" },
        { id: "B", routing_method: "manual_claim" },
        { id: "C", routing_method: null },
        { id: "D", routing_method: "auto_least_loaded" },
        { id: "E", routing_method: "manual_assign" },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: checks, support_conversations: convs },
        calls
      ) as never
    );

    const out = (await fetchRoutingReadout({ companyId: "co1" })) as {
      cohorts: Record<"autoRouted" | "manualClaim" | "unrouted", Record<string, number | null>>;
    };

    // autoRouted = A, D (both held)
    expect(out.cohorts.autoRouted).toMatchObject({
      conversationCount: 2,
      durabilityHeld: 2,
      durabilityHeldRate: 1,
    });
    // manualClaim = B (reopened) + E (inconclusive) — both manual variants land here
    expect(out.cohorts.manualClaim).toMatchObject({
      conversationCount: 2,
      durabilityReopened: 1,
      durabilityInconclusive: 1,
      durabilityHeld: 0,
      durabilityHeldRate: 0,
    });
    // unrouted = C (held) — null method
    expect(out.cohorts.unrouted).toMatchObject({
      conversationCount: 1,
      durabilityHeld: 1,
      durabilityHeldRate: 1,
    });
  });

  it("returns empty cohorts (null held-rates) when there are no durability checks", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: { data: [] }, support_conversations: { data: [] } },
        calls
      ) as never
    );
    const out = (await fetchRoutingReadout({ companyId: "co1" })) as {
      cohorts: Record<"autoRouted" | "manualClaim" | "unrouted", Record<string, number | null>>;
    };
    expect(out.cohorts.autoRouted.conversationCount).toBe(0);
    expect(out.cohorts.manualClaim.conversationCount).toBe(0);
    expect(out.cohorts.unrouted.conversationCount).toBe(0);
    expect(out.cohorts.autoRouted.durabilityHeldRate).toBeNull();
  });
});
