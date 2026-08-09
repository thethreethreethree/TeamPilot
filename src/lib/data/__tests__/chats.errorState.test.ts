import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Error-as-no-data guard for the chat detail reads (INV22 / §3.4). A transient read failure must not render a
 * live topic as "not found" or its thread as empty (looks deleted). fetchTopic/fetchMessages/fetchParticipants
 * classified triage — the HIGH, user-facing "looks gone" reads in the 2026-08-09 error-as-no-data sweep. The
 * chat page catches the throw into an honest error state. Detection-true: each rejects on error; the genuine
 * not-found/empty path is preserved.
 */

let RESULT: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock("@/lib/supabase/client", () => {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "is", "in", "order", "maybeSingle"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(RESULT);
  return { supabaseEnabled: true, createClient: () => b };
});

import { fetchTopic, fetchMessages, fetchParticipants } from "../chats";

beforeEach(() => {
  RESULT = { data: null, error: null };
});

describe("chat detail reads — classify the error (no error-as-no-data)", () => {
  it("fetchTopic THROWS on a read error (not null → 'topic not found')", async () => {
    RESULT = { data: null, error: { message: "connection reset" } };
    await expect(fetchTopic("c1")).rejects.toThrow(/Failed to load the topic/i);
  });

  it("fetchMessages THROWS on a read error (not [] → empty thread / looks wiped)", async () => {
    RESULT = { data: null, error: { message: "timeout" } };
    await expect(fetchMessages("c1")).rejects.toThrow(/Failed to load the messages/i);
  });

  it("fetchParticipants THROWS on a read error (not [])", async () => {
    RESULT = { data: null, error: { message: "timeout" } };
    await expect(fetchParticipants("c1")).rejects.toThrow(/Failed to load the participants/i);
  });

  it("fetchTopic returns null on a GENUINE not-found (no error) — honest 404 preserved", async () => {
    RESULT = { data: null, error: null };
    expect(await fetchTopic("c1")).toBeNull();
  });

  it("fetchMessages returns [] on a genuine empty thread (no error)", async () => {
    RESULT = { data: [], error: null };
    expect(await fetchMessages("c1")).toEqual([]);
  });
});
