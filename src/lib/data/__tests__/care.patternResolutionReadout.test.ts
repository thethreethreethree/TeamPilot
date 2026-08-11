import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchPatternResolutionReadout is the §3.5 "does the team get FASTER + more durable at a category once a
 * pattern forms?" measure. Per category (only those with >= 3 resolutions), it sets the cutoff at the 3rd
 * resolution's created_at, then buckets each unique conversation BEFORE (created_at < cutoff) vs AFTER, and
 * per bucket computes median time-to-resolve (resolved_at - first_message_at) + durability held-rate.
 *
 * This pins the non-SQL logic that's easy to get wrong: the >=3 category threshold + exclusion, the cutoff =
 * arr[2].created_at (so the first two resolutions are "before", the 3rd onward "after"), per-conversation
 * dedup, the median (even-count average of the two middle values), the held-rate (held/checked), and the
 * sort-by-totalResolutions. Written from a full read of the function (deliberately not rushed).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchPatternResolutionReadout } from "../care";

describe("fetchPatternResolutionReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("cuts at the 3rd resolution, buckets before/after, and computes median + held-rate per bucket", async () => {
    // "billing": 4 resolutions (qualifies). Sorted asc by created_at (the fn relies on the .order the mock ignores).
    // cutoff = 3rd resolution's created_at = 2026-01-03 → r1,r2 BEFORE; r3,r4 AFTER.
    const resolutions = {
      data: [
        { id: "b1", conversation_id: "X1", category: "billing", created_at: "2026-01-01T00:00:00Z" },
        { id: "b2", conversation_id: "X2", category: "billing", created_at: "2026-01-02T00:00:00Z" },
        { id: "b3", conversation_id: "X3", category: "billing", created_at: "2026-01-03T00:00:00Z" },
        { id: "b4", conversation_id: "X4", category: "billing", created_at: "2026-01-04T00:00:00Z" },
        // "shipping": only 2 resolutions → EXCLUDED (< 3), must not appear in patterns.
        { id: "s1", conversation_id: "Y1", category: "shipping", created_at: "2026-01-01T00:00:00Z" },
        { id: "s2", conversation_id: "Y2", category: "shipping", created_at: "2026-01-02T00:00:00Z" },
      ],
    };
    const convs = {
      data: [
        { id: "X1", first_message_at: "2026-01-01T00:00:00Z", resolved_at: "2026-01-01T02:00:00Z" }, // 120 min
        { id: "X2", first_message_at: "2026-01-02T00:00:00Z", resolved_at: "2026-01-02T01:00:00Z" }, // 60 min
        { id: "X3", first_message_at: "2026-01-03T00:00:00Z", resolved_at: "2026-01-03T00:30:00Z" }, // 30 min
        { id: "X4", first_message_at: "2026-01-04T00:00:00Z", resolved_at: "2026-01-04T00:10:00Z" }, // 10 min
      ],
    };
    const durability = {
      data: [
        { conversation_id: "X1", outcome: "held" },
        { conversation_id: "X2", outcome: "reopened" },
        { conversation_id: "X3", outcome: "held" },
        { conversation_id: "X4", outcome: "held" },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          support_resolutions: resolutions,
          support_conversations: convs,
          support_durability_checks: durability,
        },
        calls
      ) as never
    );

    const out = await fetchPatternResolutionReadout({ companyId: "co1" });

    // shipping excluded → exactly one pattern
    expect(out.patterns).toHaveLength(1);
    const p = out.patterns[0]!;
    expect(p.category).toBe("billing");
    expect(p.patternFormedAt).toBe("2026-01-03T00:00:00Z"); // the 3rd resolution's created_at
    expect(p.totalResolutions).toBe(4);

    // BEFORE = X1 (120, held), X2 (60, reopened) → median 90, held 1 of 2
    expect(p.before).toMatchObject({
      conversationCount: 2,
      medianTimeToResolveMinutes: 90,
      durabilityChecked: 2,
      durabilityHeld: 1,
      durabilityHeldRate: 0.5,
    });
    // AFTER = X3 (30, held), X4 (10, held) → median 20, held 2 of 2 (faster + more durable once the pattern formed)
    expect(p.after).toMatchObject({
      conversationCount: 2,
      medianTimeToResolveMinutes: 20,
      durabilityChecked: 2,
      durabilityHeld: 2,
      durabilityHeldRate: 1,
    });
  });

  it("returns no patterns when no category reaches the 3-resolution threshold", async () => {
    const resolutions = {
      data: [
        { id: "a1", conversation_id: "X1", category: "billing", created_at: "2026-01-01T00:00:00Z" },
        { id: "a2", conversation_id: "X2", category: "billing", created_at: "2026-01-02T00:00:00Z" },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_resolutions: resolutions, support_conversations: { data: [] }, support_durability_checks: { data: [] } },
        calls
      ) as never
    );
    const out = await fetchPatternResolutionReadout({ companyId: "co1" });
    expect(out.patterns).toEqual([]);
  });
});
