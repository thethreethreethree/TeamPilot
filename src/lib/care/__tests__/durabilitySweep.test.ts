import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * sweepDurabilityChecks is the §3.5 durability loop's scheduled hinge: it turns
 * due-but-unchecked support_durability_checks into agent-visible due events
 * (dedup'd by emit_care_durability_due_event, migration 0054). It had ZERO test
 * coverage. These pin:
 *   - the FIFO order fix (2026-07-09): capped at 500/run, so it MUST scan
 *     scheduled_for ASC or a >500 backlog could starve the oldest checks forever
 *     (their §3.5 consequence measurement would never reach the agent);
 *   - it only touches due (scheduled_for <= now) + unchecked (checked_at null) rows;
 *   - it emits the dedup'd event per check and counts only successful emits;
 *   - a read error THROWS (not a silent empty sweep).
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { sweepDurabilityChecks } from "../durabilitySweep";

type Call = [string, unknown[]];

describe("sweepDurabilityChecks — §3.5 due-check sweep", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("scans oldest-due-first (FIFO), filters due-but-unchecked, emits the dedup'd event per check", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { support_durability_checks: { data: [{ id: "k1" }, { id: "k2" }] } },
        calls
      ) as never
    );

    const res = await sweepDurabilityChecks();

    expect(res).toMatchObject({ ok: true, scanned: 2, emittedAttempts: 2, bounded: false });
    // THE FIFO fix: ordered by scheduled_for ASC so a >500 backlog can't starve the
    // oldest checks. If this ever drops, old due checks silently never get swept.
    expect(
      calls.some(
        ([m, a]) =>
          m === "order" &&
          a[0] === "scheduled_for" &&
          (a[1] as { ascending?: boolean } | undefined)?.ascending === true
      )
    ).toBe(true);
    // Only due-but-unchecked rows.
    expect(calls.some(([m, a]) => m === "is" && a[0] === "checked_at" && a[1] === null)).toBe(true);
    expect(calls.some(([m, a]) => m === "lte" && a[0] === "scheduled_for")).toBe(true);
    // Emits the dedup'd due-event per check, by id.
    const rpcCalls = calls.filter(([m]) => m === "rpc");
    expect(rpcCalls.length).toBe(2);
    expect(rpcCalls[0]![1][0]).toBe("emit_care_durability_due_event");
    expect(rpcCalls[0]![1][1]).toEqual({ p_check_id: "k1" });
  });

  it("counts only successful emits — a failing rpc is scanned but not counted", async () => {
    let n = 0;
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          support_durability_checks: { data: [{ id: "k1" }, { id: "k2" }] },
          // first emit fails, second succeeds
          "rpc:emit_care_durability_due_event": () =>
            n++ === 0 ? { error: { message: "boom" } } : { error: null },
        },
        calls
      ) as never
    );

    const res = await sweepDurabilityChecks();
    expect(res.scanned).toBe(2);
    expect(res.emittedAttempts).toBe(1);
  });

  it("sets bounded=true when the run hits the scan cap (§3.4 honest-bound — a backlog exists)", async () => {
    // A full page (>= DUE_SCAN_LIMIT=500) means there may be more due than one run
    // processes. bounded must surface it so a silent cap can't read as "all done."
    const fullPage = Array.from({ length: 500 }, (_, i) => ({ id: `k${i}` }));
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ support_durability_checks: { data: fullPage } }, calls) as never
    );
    const res = await sweepDurabilityChecks();
    expect(res.scanned).toBe(500);
    expect(res.bounded).toBe(true);
  });

  it("THROWS on a read error (not a silent empty sweep)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { support_durability_checks: { data: null, error: { message: "db down" } } },
        calls
      ) as never
    );
    await expect(sweepDurabilityChecks()).rejects.toThrow("db down");
  });
});
