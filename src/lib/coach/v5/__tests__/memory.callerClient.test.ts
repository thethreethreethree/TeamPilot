import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The C.A.R.E extension's coach was running with no memory of the user, silently.
 *
 * `loadCoachMemory` resolved its own Supabase client with `createClient()`, which
 * reads a session from COOKIES. `care/extension/coach` authenticates with a
 * BEARER token and sends none, so `auth.getUser()` saw nobody and the function
 * returned EMPTY_SNAPSHOT. `renderMemoryForPrompt` then returned null — "not
 * enough signal — better silent than wrong" — so every extension coach call ran
 * as if it had never met the user.
 *
 * Nothing errored. The memory was in the database the whole time; the client
 * could not see it, and the code concluded there was none. That is an unknown
 * dressed as a zero, and what it quietly switched off is the §3.4 thesis — the
 * coach deriving behaviour from each team's accumulated data — for every
 * extension user.
 *
 * These pin the class rather than the instance: a caller that hands over its own
 * client must have that client used. `createClient` is mocked to THROW, so any
 * fallback to the cookie session is visible — though note the function swallows
 * errors by design, so the throw shows up as a count and an empty snapshot
 * rather than a rejection.
 */

const cookieClientUsed = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    cookieClientUsed.count += 1;
    throw new Error("cookie client reached");
  },
}));

import { loadCoachMemory, renderMemoryForPrompt } from "../memory";

/**
 * A caller's client holding real history.
 *
 * The rows use the ACTUAL event kinds and payload keys the aggregator reads —
 * `coach.analyze_returned` with a `principle`, and `coach.message_graded` with a
 * `grade`. Inventing a plausible-looking shape here would have produced a test
 * that passed while proving nothing, which is how the first draft of this file
 * was wrong.
 */
function callerDb() {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: "coach.analyze_returned",
      payload: { principle: `principle-${i % 2}`, book: "Never Split the Difference" },
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: "coach.message_graded",
      payload: { grade: i % 2 === 0 ? "productive" : "neutral" },
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
    })),
  ];
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    in: chain,
    gte: chain,
    order: chain,
    limit: chain,
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
  });
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => builder,
  } as never;
}

beforeEach(() => {
  cookieClientUsed.count = 0;
});

describe("loadCoachMemory honours the caller's client", () => {
  it("never falls back to the cookie session when given a client", async () => {
    await loadCoachMemory(callerDb());
    expect(cookieClientUsed.count).toBe(0);
  });

  it("a Bearer caller gets the user's real history, not an empty snapshot", async () => {
    const snap = await loadCoachMemory(callerDb());
    // The bug returned EMPTY_SNAPSHOT (totalAnalyses 0), which reads as "this
    // user has no history" rather than "we could not look".
    expect(snap.totalAnalyses).toBe(6);
    expect(snap.totalGraded).toBe(6);
    expect(snap.patterns.length).toBeGreaterThan(0);
  });

  it("real history produces a prompt block; an empty snapshot produces none", async () => {
    // This is the consequence that reached users: with the empty snapshot the
    // coach's prompt carried no USER PATTERN HISTORY at all.
    const empty = renderMemoryForPrompt({
      totalAnalyses: 0,
      patterns: [],
      recentGradeMix: { productive: 0, neutral: 0, needsGuidance: 0 },
      totalGraded: 0,
    });
    expect(empty).toBeNull();

    const real = renderMemoryForPrompt(await loadCoachMemory(callerDb()));
    expect(real).not.toBeNull();
    expect(real).toContain("USER PATTERN HISTORY");
  });

  it("omitting the client still uses the cookie session, so no web caller changed", async () => {
    // It does not REJECT: the function swallows failures and answers with the
    // empty snapshot by design. The count is what proves the cookie path ran.
    const snap = await loadCoachMemory();
    expect(cookieClientUsed.count).toBe(1);
    expect(snap.totalAnalyses).toBe(0);
  });
});
