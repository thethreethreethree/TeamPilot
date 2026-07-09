import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchPatternResolutionReadout answers the §4 question: once a category crossed
 * the §3.2 threshold (its 3rd resolution = the "pattern formed" cutoff), did
 * resolution get faster / more durable AFTER vs BEFORE? Distinct before/after +
 * median logic. Pins: the <3-resolution SKIP, the cutoff = 3rd resolution, the
 * before/after split by resolution created_at, median time-to-resolve, and the
 * per-bucket durability rate.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchPatternResolutionReadout } from "../care";

function res(id: string, conv: string, category: string, createdAt: string) {
  return { id, conversation_id: conv, category, created_at: createdAt };
}
function conv(id: string, fm: string, resolvedMins: number) {
  return {
    id,
    first_message_at: fm,
    resolved_at: new Date(new Date(fm).getTime() + resolvedMins * 60_000).toISOString(),
  };
}

describe("fetchPatternResolutionReadout (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("forms a pattern at the 3rd resolution and compares before/after", async () => {
    // Category A: 4 resolutions -> pattern; cutoff = R3.created_at (07-03).
    // Category B: 2 resolutions -> SKIPPED.
    const resolutions = {
      data: [
        res("r1", "a1", "A", "2026-07-01T00:00:00Z"),
        res("rb1", "b1", "B", "2026-07-01T01:00:00Z"),
        res("r2", "a2", "A", "2026-07-02T00:00:00Z"),
        res("rb2", "b2", "B", "2026-07-02T01:00:00Z"),
        res("r3", "a3", "A", "2026-07-03T00:00:00Z"), // cutoff
        res("r4", "a4", "A", "2026-07-04T00:00:00Z"),
      ],
    };
    const conversations = {
      data: [
        conv("a1", "2026-07-01T00:00:00Z", 10), // before bucket, ttr 10
        conv("a2", "2026-07-02T00:00:00Z", 30), // before bucket, ttr 30
        conv("a3", "2026-07-03T00:00:00Z", 5), // after bucket, ttr 5
        conv("a4", "2026-07-04T00:00:00Z", 15), // after bucket, ttr 15
      ],
    };
    const durability = {
      data: [
        { conversation_id: "a1", outcome: "held" },
        { conversation_id: "a2", outcome: "reopened" },
        { conversation_id: "a3", outcome: "held" },
        { conversation_id: "a4", outcome: "held" },
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        {
          support_resolutions: resolutions,
          support_conversations: conversations,
          support_durability_checks: durability,
        },
        calls
      ) as never
    );

    const out = await fetchPatternResolutionReadout({ companyId: "co1" });

    // Only category A forms a pattern; B (2 resolutions) is skipped.
    expect(out.patterns).toHaveLength(1);
    const p = out.patterns[0]!;
    expect(p.category).toBe("A");
    expect(p.patternFormedAt).toBe("2026-07-03T00:00:00Z");
    expect(p.totalResolutions).toBe(4);

    // before = R1,R2 (created < cutoff): median(10,30)=20, held 1/2.
    expect(p.before.conversationCount).toBe(2);
    expect(p.before.medianTimeToResolveMinutes).toBe(20);
    expect(p.before.durabilityHeldRate).toBeCloseTo(0.5);

    // after = R3,R4 (created >= cutoff): median(5,15)=10, held 2/2 -> faster + more durable.
    expect(p.after.conversationCount).toBe(2);
    expect(p.after.medianTimeToResolveMinutes).toBe(10);
    expect(p.after.durabilityHeldRate).toBe(1);
  });

  it("returns no patterns when no category reaches 3 resolutions", async () => {
    const resolutions = {
      data: [
        res("r1", "a1", "A", "2026-07-01T00:00:00Z"),
        res("r2", "a2", "A", "2026-07-02T00:00:00Z"),
      ],
    };
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_resolutions: resolutions }, calls) as never
    );
    const out = await fetchPatternResolutionReadout({ companyId: "co1" });
    expect(out.patterns).toEqual([]);
  });

  // §3.4 honest-error-state (audit 2026-07-09): a resolutions read failure must
  // throw, not return an empty pattern set as if there were no data.
  it("THROWS on a resolutions read error", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient(
        { support_resolutions: { data: null, error: { message: "db down" } } },
        calls
      ) as never
    );
    await expect(fetchPatternResolutionReadout({ companyId: "co1" })).rejects.toThrow(
      "resolutions read failed"
    );
  });
});
