import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PROOF-OF-CONCEPT: unit-testing a DB data-layer function by mocking the
 * Supabase client, WITHOUT a live database.
 *
 * The data-layer functions create their client internally, so we mock the
 * module and feed a chainable "query builder" that (a) records the calls (so we
 * can assert the query is scoped correctly) and (b) resolves to canned rows.
 * This proves the pattern is feasible with a ~30-line helper — informing the
 * "should we invest in a DB integration harness?" decision with something
 * concrete rather than abstract.
 *
 * What it verifies for listAgentSessions: it queries coaching_sessions, scopes
 * by agent_id (the owner-scoping that matters for §A18), and maps snake_case
 * rows to the camelCase domain shape.
 */

// A Supabase-client stand-in. The CLIENT itself is a plain (non-thenable)
// object — otherwise mockResolvedValue would follow its `.then` and unwrap it.
// Only the query BUILDER returned by .from() is the chainable, call-recording,
// awaitable proxy.
function makeClient(result: unknown, calls: Array<[string, unknown[]]>) {
  const builder: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        // Awaiting the chain calls `.then` — resolve to the canned result.
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        // Any query method (select/eq/order/limit/...) records + chains.
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return builder;
        };
      },
    }
  );
  return {
    from: (...args: unknown[]) => {
      calls.push(["from", args]);
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listAgentSessions } from "../salesCoach";

const ROW = {
  id: "s1",
  company_id: "co1",
  agent_id: "agent-42",
  context: "in_person",
  client_label: "Maple St",
  status: "ended",
  audio_asset_url: null,
  started_at: "2026-07-01T10:00:00Z",
  ended_at: "2026-07-01T10:20:00Z",
  territory: null,
  approach: null,
  offer: null,
  outcome: "sold",
};

describe("listAgentSessions (DB-mock PoC)", () => {
  let calls: Array<[string, unknown[]]>;

  beforeEach(() => {
    calls = [];
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ data: [ROW] }, calls) as never
    );
  });

  it("queries coaching_sessions scoped to the agent and maps the row", async () => {
    const sessions = await listAgentSessions("agent-42", 25);

    // Scoped to the coaching_sessions table...
    expect(calls.some(([m, a]) => m === "from" && a[0] === "coaching_sessions")).toBe(true);
    // ...and filtered by the owning agent (the §A18 owner-scope).
    expect(
      calls.some(([m, a]) => m === "eq" && a[0] === "agent_id" && a[1] === "agent-42")
    ).toBe(true);
    // ...honoring the passed limit.
    expect(calls.some(([m, a]) => m === "limit" && a[0] === 25)).toBe(true);

    // Row mapped snake_case -> camelCase domain shape.
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "s1",
      companyId: "co1",
      agentId: "agent-42",
      clientLabel: "Maple St",
      status: "ended",
      outcome: "sold",
    });
  });

  it("returns [] when the query yields no rows", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient({ data: null }, calls) as never);
    expect(await listAgentSessions("agent-42")).toEqual([]);
  });
});
