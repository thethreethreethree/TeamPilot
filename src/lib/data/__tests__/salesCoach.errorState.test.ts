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

import {
  getSession,
  getSessionTranscript,
  getSessionTranscriptAdmin,
  getSessionCuesAdmin,
  getSessionCueOutcomesAdmin,
  getLatestAfterPitchSummaryAdmin,
  getRecentAfterPitchSummariesAdmin,
  getAgentCoachStart,
  listAgentSessions,
} from "../salesCoach";

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

/**
 * MEDIUM error-as-no-data sweep (2026-08-10): the After-Pitch + session-list admin reads destructured only
 * `data`, so a transient error became [] / null and silently misled — a summary built from zero cues, a stored
 * summary read as "none yet", a masked null RESETTING the 3-day observe window, a rep's whole history blank.
 * Now they throw on error; [] / null reserved for genuine empty. Detection-true (fails on the pre-fix reads).
 */
describe("after-pitch + session-list reads — MEDIUM error-as-no-data sweep", () => {
  it("getSessionCuesAdmin THROWS on error (the assembler must not build a summary from zero cues)", async () => {
    ADMIN = { data: null, error: { message: "reset" } };
    await expect(getSessionCuesAdmin("s1")).rejects.toThrow(/Failed to load session cues/i);
  });
  it("getSessionCuesAdmin returns [] on a genuinely cue-less session (no error)", async () => {
    ADMIN = { data: [], error: null };
    expect(await getSessionCuesAdmin("s1")).toEqual([]);
  });
  it("getSessionCueOutcomesAdmin THROWS on error (not 'every cue had no outcome')", async () => {
    ADMIN = { data: null, error: { message: "timeout" } };
    await expect(getSessionCueOutcomesAdmin("s1")).rejects.toThrow(/Failed to load cue outcomes/i);
  });
  it("getLatestAfterPitchSummaryAdmin THROWS on error (not 'no summary yet' → regenerate/blank)", async () => {
    ADMIN = { data: null, error: { message: "reset" } };
    await expect(getLatestAfterPitchSummaryAdmin("s1")).rejects.toThrow(
      /Failed to load the after-pitch summary/i
    );
  });
  it("getLatestAfterPitchSummaryAdmin returns null on a genuine no-summary (no error)", async () => {
    ADMIN = { data: null, error: null };
    expect(await getLatestAfterPitchSummaryAdmin("s1")).toBeNull();
  });
  it("getRecentAfterPitchSummariesAdmin THROWS on error (not the rep having 'no history yet')", async () => {
    ADMIN = { data: null, error: { message: "timeout" } };
    await expect(getRecentAfterPitchSummariesAdmin("agent-1")).rejects.toThrow(/after-pitch summaries/i);
  });
  it("getAgentCoachStart THROWS on error (a masked null RESETS the 3-day observe window)", async () => {
    ADMIN = { data: null, error: { message: "reset" } };
    await expect(getAgentCoachStart("agent-1")).rejects.toThrow(/coach start/i);
  });
  it("getAgentCoachStart returns null on a genuine no-sessions-yet (no error)", async () => {
    ADMIN = { data: null, error: null };
    expect(await getAgentCoachStart("agent-1")).toBeNull();
  });
  it("listAgentSessions THROWS on error (not an empty history — 'your data is gone')", async () => {
    SERVER = { data: null, error: { message: "timeout" } };
    await expect(listAgentSessions("agent-1")).rejects.toThrow(/Failed to load the agent's sessions/i);
  });
});
