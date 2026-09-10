import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * listAgentSessions must read through the CALLER'S client.
 *
 * Both callers are Bearer-reachable routes that resolve a scoped client for auth and then called this,
 * which resolved its OWN cookie client — the F22 shape exactly: scoped for identity, anonymous for the
 * read. A phone sends no cookies, so the read returned an empty array, and an empty array is
 * indistinguishable from "this rep has no sessions".
 *
 * Confirmed live on 2026-09-11 rather than inferred: /strategy-library with a real rep's Bearer token
 * returned 13 correct lines with `sessionLabel` and `outcome` null on ALL THIRTEEN — both are read from
 * this list. A rep opening their Strategy Library on the phone saw their own best lines stripped of which
 * call they came from and whether it sold. Every one of the 344 tests over these routes passed while that
 * was true, which is why this one exists.
 */
const cookieClientCalls = vi.hoisted(() => ({ n: 0 }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    cookieClientCalls.n += 1;
    return chainReturning([{ id: "from-cookie-client" }]);
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: vi.fn() }));

/** A client whose one query resolves to the rows given. */
function chainReturning(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.limit = async () => ({ data: rows, error: null });
  return { from: () => chain } as never;
}

import { listAgentSessions } from "../salesCoach";

beforeEach(() => {
  cookieClientCalls.n = 0;
  vi.clearAllMocks();
});

describe("listAgentSessions", () => {
  it("reads through the client it is GIVEN, and never resolves a cookie client", async () => {
    const scoped = chainReturning([{ id: "from-scoped-client" }]);
    const out = await listAgentSessions("rep1", 50, scoped);
    expect(out.map((s) => s.id)).toEqual(["from-scoped-client"]);
    // The load-bearing half: a phone's read must not fall back to cookies, which authenticate nobody.
    expect(cookieClientCalls.n).toBe(0);
  });

  it("still falls back to the cookie client when none is passed — the web path is unchanged", async () => {
    const out = await listAgentSessions("rep1");
    expect(out.map((s) => s.id)).toEqual(["from-cookie-client"]);
    expect(cookieClientCalls.n).toBe(1);
  });
});
