import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for the tasks read functions (INV22 / §3.4 honesty — a transient DB read failure must
 * NOT look like a deleted/not-found task or an empty thread). Before this fix, fetchTask/Messages/Participants/
 * Steps destructured only `data` and returned null/[] on `!data`, so a query error rendered "task not found" or
 * an empty list. Now they classify the error and throw so the page shows an honest error state. Detection-true:
 * with an error present, each MUST reject; with no error, the not-found (null) path is preserved.
 */

let RESULT: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock("@/lib/supabase/client", () => {
  // A chainable, awaitable query-builder stub: every method returns the builder, awaiting it yields RESULT.
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "is", "order", "maybeSingle"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(RESULT);
  return { supabaseEnabled: true, createClient: () => b };
});

import { fetchTask, fetchTaskMessages, fetchTaskParticipants, fetchTaskSteps } from "../tasks";

beforeEach(() => {
  RESULT = { data: null, error: null };
});

describe("tasks read functions — classify the error (no error-as-no-data)", () => {
  it("fetchTask THROWS on a read error (not null → 'task not found')", async () => {
    RESULT = { data: null, error: { message: "connection reset" } };
    await expect(fetchTask("t1")).rejects.toThrow(/Failed to load the task/i);
  });

  it("fetchTaskMessages THROWS on a read error (not [] → empty thread)", async () => {
    RESULT = { data: null, error: { message: "timeout" } };
    await expect(fetchTaskMessages("t1")).rejects.toThrow(/Failed to load the task messages/i);
  });

  it("fetchTaskParticipants THROWS on a read error (not [])", async () => {
    RESULT = { data: null, error: { message: "timeout" } };
    await expect(fetchTaskParticipants("t1")).rejects.toThrow(/Failed to load the task participants/i);
  });

  it("fetchTaskSteps THROWS on a read error (not [] → steps look deleted)", async () => {
    RESULT = { data: null, error: { message: "timeout" } };
    await expect(fetchTaskSteps("t1")).rejects.toThrow(/Failed to load the task steps/i);
  });

  it("fetchTask still returns null on a GENUINE not-found (no error) — the honest 404 path is preserved", async () => {
    RESULT = { data: null, error: null };
    expect(await fetchTask("t1")).toBeNull();
  });

  it("fetchTaskMessages returns [] on a genuine empty thread (no error)", async () => {
    RESULT = { data: [], error: null };
    expect(await fetchTaskMessages("t1")).toEqual([]);
  });
});
