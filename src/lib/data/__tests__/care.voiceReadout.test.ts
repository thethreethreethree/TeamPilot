import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchVoiceValueReadout is the §3.5 "does voice change outcomes?" measure — it buckets
 * durability-checked conversations into voiceUsed vs voiceNotUsed cohorts (voiceUsed = ANY customer message
 * with medium='voice') and compares durability. This pins the JS aggregation logic — the cohort bucketing,
 * the ANY-voice precedence, the per-cohort outcome counts + held-rate — which is the part that isn't SQL.
 * (The sibling coach-rubric / co-pilot / SLA readouts already have this coverage; voice was the gap.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchVoiceValueReadout } from "../care";

describe("fetchVoiceValueReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("buckets by ANY-voice, counts durability per cohort, and computes held-rate", async () => {
    const checks = {
      data: [
        { conversation_id: "A", outcome: "held" }, // voice
        { conversation_id: "B", outcome: "reopened" }, // text-only
        { conversation_id: "C", outcome: "held" }, // voice
        { conversation_id: "MIX", outcome: "held" }, // text + voice → ANY voice wins
      ],
    };
    const messages = {
      data: [
        { conversation_id: "A", medium: "voice" },
        { conversation_id: "B", medium: "text" },
        { conversation_id: "C", medium: "voice" },
        { conversation_id: "MIX", medium: "text" },
        { conversation_id: "MIX", medium: "voice" }, // one voice message flips MIX to voiceUsed
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: checks, support_messages: messages },
        calls
      ) as never
    );

    const out = (await fetchVoiceValueReadout({ companyId: "co1" })) as {
      cohorts: Record<"voiceUsed" | "voiceNotUsed", Record<string, number | null>>;
    };

    // voiceUsed = A, C, MIX (all held) → 3 held of 3
    expect(out.cohorts.voiceUsed).toMatchObject({
      conversationCount: 3,
      durabilityHeld: 3,
      durabilityReopened: 0,
      durabilityHeldRate: 1,
    });
    // voiceNotUsed = B (reopened) → 0 held of 1
    expect(out.cohorts.voiceNotUsed).toMatchObject({
      conversationCount: 1,
      durabilityReopened: 1,
      durabilityHeld: 0,
      durabilityHeldRate: 0,
    });
  });

  it("returns empty cohorts when there are no durability checks (no fabricated data, §3.4)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_durability_checks: { data: [] }, support_messages: { data: [] } },
        calls
      ) as never
    );
    const out = (await fetchVoiceValueReadout({ companyId: "co1" })) as {
      cohorts: Record<"voiceUsed" | "voiceNotUsed", Record<string, number | null>>;
    };
    expect(out.cohorts.voiceUsed.conversationCount).toBe(0);
    expect(out.cohorts.voiceNotUsed.conversationCount).toBe(0);
    expect(out.cohorts.voiceUsed.durabilityHeldRate).toBeNull(); // null, not 0 — no data ≠ 0% held
  });
});
