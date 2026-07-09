import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * setSessionOutcome records the call OUTCOME (sold/no_sale/…) — half the ELO game
 * score (§3.5) — and appends an immutable coach.session_outcome_recorded event
 * (§3.1). Two contracts worth pinning:
 *   - it returns NULL on a DB error (NOT a throw, NOT a phantom session): the route
 *     relies on that null to return 500, so a refactor changing it silently breaks
 *     the route's honest-failure path;
 *   - the append-only §3.1 event is emitted on success (best-effort, must not undo
 *     the column write, but must fire on the happy path).
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { setSessionOutcome } from "../salesCoach";

type Call = [string, unknown[]];
function find(calls: Call[], method: string): Record<string, unknown> | undefined {
  const hit = calls.find(([m]) => m === method);
  return hit ? (hit[1][0] as Record<string, unknown>) : undefined;
}

const SESSION_ROW = {
  id: "s1",
  company_id: "co1",
  agent_id: "a1",
  status: "reviewed",
  outcome: "sold",
  client_label: "Door 12",
  context: null,
  started_at: "2026-07-09T00:00:00Z",
  ended_at: "2026-07-09T00:20:00Z",
};

describe("setSessionOutcome — §3.5 ELO feed + honest null-on-error", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("updates the outcome column and appends the §3.1 coach.session_outcome_recorded event", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { coaching_sessions: { data: SESSION_ROW, error: null }, events: { data: [] } },
        calls
      ) as never
    );

    const r = await setSessionOutcome({ sessionId: "s1", outcome: "sold", actorId: "a1" });

    expect(r).not.toBeNull();
    // The column update carries the outcome (the §3.5 ELO input).
    expect(find(calls, "update")).toMatchObject({ outcome: "sold" });
    // The append-only §3.1 event fired.
    expect(find(calls, "insert")).toMatchObject({
      kind: "coach.session_outcome_recorded",
      subject: "sales_session:s1",
    });
  });

  it("returns NULL on a DB error — the contract the route's 500 relies on (no false-ok, no throw)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { coaching_sessions: { data: null, error: { message: "db down" } } },
        calls
      ) as never
    );

    const r = await setSessionOutcome({ sessionId: "s1", outcome: "sold", actorId: "a1" });

    expect(r).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("setSessionOutcome"));
    errSpy.mockRestore();
  });
});
