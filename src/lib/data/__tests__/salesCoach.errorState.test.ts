import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for the coaching-session HIGH reads (INV22 / §3.4). getSession classified triage: a
 * transient error must not render a live session as not-found (routes 404 → "session deleted"); getSessionTranscript
 * / getSessionTranscriptAdmin: an empty transcript on error is acute — review/dissect/summarize routes would
 * generate a coaching review from NOTHING and persist it. Now all three throw. Detection-true: each rejects on
 * error; null/[] reserved for genuine not-found/empty.
 */

let SERVER: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let ADMIN: { data: unknown; error: { message: string } | null } = { data: null, error: null };

// The CLIENT must NOT be a thenable (else `await createServerClient()` collapses it to the query result). Only
// the query-builder returned by `.from(...)` is thenable, resolving to {data,error} when the chain is awaited.
function client(getResult: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order", "limit", "maybeSingle"]) q[m] = () => q;
  (q as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(getResult());
  return { from: () => q };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client(() => SERVER)) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client(() => ADMIN)) }));

import { getSession, getSessionTranscript, getSessionTranscriptAdmin } from "../salesCoach";

beforeEach(() => {
  SERVER = { data: null, error: null };
  ADMIN = { data: null, error: null };
});

describe("coaching-session reads — classify the error (no error-as-no-data)", () => {
  it("getSession THROWS on a read error (not null → false 'session not found')", async () => {
    SERVER = { data: null, error: { message: "connection reset" } };
    await expect(getSession("s1")).rejects.toThrow(/Failed to load the coaching session/i);
  });

  it("getSessionTranscript THROWS on a read error (not [] → review from an empty transcript)", async () => {
    SERVER = { data: null, error: { message: "timeout" } };
    await expect(getSessionTranscript("s1")).rejects.toThrow(/Failed to load the session transcript/i);
  });

  it("getSessionTranscriptAdmin THROWS on a read error (skills/backfill must not compute over empty)", async () => {
    ADMIN = { data: null, error: { message: "timeout" } };
    await expect(getSessionTranscriptAdmin("s1")).rejects.toThrow(/Failed to load the session transcript/i);
  });

  it("getSession returns null on a genuine not-found (no error) — honest 404 preserved", async () => {
    SERVER = { data: null, error: null };
    expect(await getSession("s1")).toBeNull();
  });

  it("getSessionTranscript returns [] on a genuine empty transcript (no error)", async () => {
    SERVER = { data: [], error: null };
    expect(await getSessionTranscript("s1")).toEqual([]);
  });
});
