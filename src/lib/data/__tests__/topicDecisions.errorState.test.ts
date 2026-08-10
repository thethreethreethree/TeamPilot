import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for fetchTopicDecision (MEDIUM sweep, 2026-08-10). Both reads (open + latest) used to
 * destructure only `data`, so a transient error made a DECIDED topic dialogue render as "no decision yet" — the
 * 4-phase flow would reopen over a real decision. Now each read throws on error; null reserved for a topic that
 * genuinely has no decision. Detection-true: rejects on error.
 */

let SERVER: { data: unknown; error: { message: string } | null } = { data: null, error: null };

function client(getResult: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "maybeSingle"]) q[m] = () => q;
  (q as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(getResult());
  return { from: () => q };
}
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => client(() => SERVER)),
  supabaseEnabled: true,
}));

import { fetchTopicDecision } from "../topicDecisions";

beforeEach(() => {
  SERVER = { data: null, error: null };
});

describe("fetchTopicDecision — classify the error (no error-as-no-data)", () => {
  it("THROWS on a read error (a decided topic must not render as 'no decision yet')", async () => {
    SERVER = { data: null, error: { message: "connection reset" } };
    await expect(fetchTopicDecision("t1")).rejects.toThrow(/Failed to load the topic decision/i);
  });

  it("returns null on a genuine no-decision (no error)", async () => {
    SERVER = { data: null, error: null };
    expect(await fetchTopicDecision("t1")).toBeNull();
  });
});
