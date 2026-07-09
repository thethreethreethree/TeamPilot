import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * recordDurabilityOutcome is a §3.5 consequence write — the durability outcome
 * (held / reopened / inconclusive) is the single most honest metric the System
 * tracks. Before the 2026-07-09 audit it did a raw, unguarded UPDATE and
 * returned void, so:
 *   - a second POST for the same checkId silently OVERWROTE held→reopened, and
 *   - the route always answered {ok:true} even for a wrong / already-recorded id.
 *
 * These tests pin the write-once fix: the write is scoped to still-unchecked
 * rows (.is("checked_at", null)), and the function reports the REAL result
 * (recorded | already_recorded | not_found) so the route can surface 409/404
 * instead of a phantom success. If a refactor drops the guard or reverts to a
 * blanket success, one of these fails.
 *
 * Mock note: recordDurabilityOutcome uses the ASYNC createClient
 * (createServerClient), so it's mocked with mockResolvedValue. It queries
 * support_durability_checks up to twice per call (the guarded update, then — only
 * on 0 rows — an existence read), so that table is handed a SEQUENCE.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { recordDurabilityOutcome } from "../care";

type Call = [string, unknown[]];

function seq(results: unknown[]) {
  const q = [...results];
  return () => (q.length > 0 ? q.shift() : { data: [] });
}

function findUpdate(calls: Call[]): Record<string, unknown> | undefined {
  const hit = calls.find(([m]) => m === "update");
  return hit ? (hit[1][0] as Record<string, unknown>) : undefined;
}

describe("recordDurabilityOutcome (DB-mock) — §3.5 write-once", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("records the outcome when the check is still unchecked, scoped write-once", async () => {
    // The guarded update matches one still-unchecked row.
    const support_durability_checks = seq([{ data: [{ id: "chk1" }], error: null }]);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks }, calls) as never
    );

    const result = await recordDurabilityOutcome({
      checkId: "chk1",
      outcome: "held",
      notes: "no recurrence in 7 days",
    });

    expect(result).toBe("recorded");
    // THE write-once guard: the update MUST be scoped to still-unchecked rows.
    // If this ever drops, a re-record silently overwrites the §3.5 metric.
    expect(
      calls.some(([m, a]) => m === "is" && a[0] === "checked_at" && a[1] === null)
    ).toBe(true);
    // The payload carries the outcome + notes (and stamps checked_at).
    const upd = findUpdate(calls);
    expect(upd).toMatchObject({ outcome: "held", notes: "no recurrence in 7 days" });
    expect(upd && "checked_at" in upd).toBe(true);
    // On the happy path it does NOT issue the existence read (early return).
    expect(calls.filter(([m]) => m === "maybeSingle").length).toBe(0);
  });

  it("reports already_recorded when the guarded write hits 0 rows but the check exists", async () => {
    const support_durability_checks = seq([
      { data: [], error: null }, // guarded update: already checked → 0 rows
      { data: { id: "chk1" } }, // existence read: the row IS there
    ]);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks }, calls) as never
    );

    const result = await recordDurabilityOutcome({ checkId: "chk1", outcome: "reopened" });

    expect(result).toBe("already_recorded");
    // It fell through to the existence read to distinguish the two 0-row causes.
    expect(calls.filter(([m]) => m === "maybeSingle").length).toBe(1);
  });

  it("reports not_found when the check is not visible to the caller (RLS / nonexistent)", async () => {
    const support_durability_checks = seq([
      { data: [], error: null }, // guarded update: 0 rows
      { data: null }, // existence read: no row visible (wrong company or gone)
    ]);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks }, calls) as never
    );

    const result = await recordDurabilityOutcome({ checkId: "nope", outcome: "inconclusive" });

    expect(result).toBe("not_found");
  });

  it("throws on a real write error (not a silent false-ok)", async () => {
    const support_durability_checks = seq([
      { data: null, error: { message: "connection reset" } },
    ]);
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient({ support_durability_checks }, calls) as never
    );

    await expect(
      recordDurabilityOutcome({ checkId: "chk1", outcome: "held" })
    ).rejects.toThrow("connection reset");
  });
});
