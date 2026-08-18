import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Guard for the addTaskStep order-collision retry (audit 2026-08-19). Concurrent adds read the same max
 * step_order and insert the same next value; the deferred UNIQUE (task_id, step_order) aborts one with 23505,
 * which the old code swallowed into `return null` — the step silently vanished. addTaskStep now retries on 23505
 * (re-reading the committed max) and only gives up on a DIFFERENT error. This locks both paths.
 */

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn(), supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/client";
import { addTaskStep } from "../tasks";

const STEP = {
  id: "s1",
  task_id: "t1",
  step_order: 5,
  body: "b",
  completed_at: null,
  completed_by: null,
  created_at: "2026-08-19T00:00:00Z",
};

/** A fake task_steps chain: reads always return max=4; inserts resolve via the supplied sequence of results. */
function fakeClient(insertResults: Array<{ data: unknown; error: unknown }>) {
  let insertCall = 0;
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "insert"]) chain[m] = () => chain;
  chain.limit = () => Promise.resolve({ data: [{ step_order: 4 }] }); // current max
  chain.single = () => Promise.resolve(insertResults[Math.min(insertCall++, insertResults.length - 1)]);
  return { from: () => chain };
}

beforeEach(() => vi.clearAllMocks());

describe("addTaskStep — retries a step_order collision instead of silently dropping the step", () => {
  it("a 23505 on the first insert retries and succeeds (the step is NOT lost)", async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeClient([{ data: null, error: { code: "23505" } }, { data: STEP, error: null }]) as never,
    );
    const step = await addTaskStep({ taskId: "t1", body: "b" });
    expect(step).not.toBeNull();
    expect(step?.stepOrder).toBe(5);
  });

  it("a non-collision error gives up immediately (returns null, no infinite retry)", async () => {
    vi.mocked(createClient).mockReturnValue(
      fakeClient([{ data: null, error: { code: "23502" } }]) as never, // not_null_violation, say
    );
    const step = await addTaskStep({ taskId: "t1", body: "b" });
    expect(step).toBeNull();
  });
});
