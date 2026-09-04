import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The door tracker was dead from the mobile app, and it reported a confident zero.
 *
 * 4 September. Every rep-facing function in `doorlog.ts` built its OWN Supabase client with
 * `createClient()`, which resolves a session from COOKIES. The mobile app authenticates with
 * a Bearer token and sends no cookies, so all of them ran ANONYMOUS for it. Measured against
 * production: `GET /door-log?date=2026-08-31` answered
 * `{doorsKnocked:0, sold:0, goBacks:0, notInterested:0}` with a **200** for a day whose rows
 * hold eight knocks and five sales, and every knock POST came back 500.
 *
 * The read is the dangerous half. A refused WRITE returns an error the app queues and
 * retries; a refused READ is indistinguishable from a quiet day at the doors, so a rep would
 * have been shown nothing at all for a day they sold five.
 *
 * These tests pin the CLASS rather than the four instances: a rep-facing function handed a
 * caller's client must USE it and must never fall back to the cookie client. `createClient`
 * is mocked to throw, so any function that reaches for it fails loudly by name instead of
 * quietly returning empty — which is exactly how the original defect hid.
 */

const cookieClientUsed = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    cookieClientUsed.count += 1;
    throw new Error(
      "cookie client reached: this function ignored the caller's client and would run anonymous for a Bearer caller",
    );
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/paginate", () => ({
  fetchAllPaged: async () => [
    { outcome: "sold" },
    { outcome: "sold" },
    { outcome: "go_back" },
    { outcome: "not_interested" },
  ],
}));

import { getKpiForDay, getAllTimeKpi } from "../doorlog";

/**
 * A caller's client that answers like the real one for these reads.
 *
 * Deliberately returns NON-ZERO rows: a function that ignored this client and somehow still
 * returned would come back empty, so the zero itself is the failure signal — the same shape
 * as the production bug.
 */
function callerDb() {
  const rows = [
    { outcome: "sold" },
    { outcome: "sold" },
    { outcome: "go_back" },
    { outcome: "not_interested" },
  ];
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    gte: chain,
    lte: chain,
    lt: chain,
    gt: chain,
    order: chain,
    limit: chain,
    maybeSingle: async () => ({ data: rows[0], error: null }),
    single: async () => ({ data: rows[0], error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
  });
  return { from: () => builder } as never;
}

beforeEach(() => {
  cookieClientUsed.count = 0;
});

describe("doorlog rep-facing reads honour the caller's client", () => {
  it("getKpiForDay never falls back to the cookie client when given one", async () => {
    await getKpiForDay("2026-08-31", "rep-1", callerDb());
    expect(cookieClientUsed.count).toBe(0);
  });

  it("getAllTimeKpi never falls back to the cookie client when given one", async () => {
    await getAllTimeKpi("rep-1", callerDb());
    expect(cookieClientUsed.count).toBe(0);
  });

  it("omitting the client still uses the cookie session, so no web caller changed", async () => {
    // The other half of the contract: `db` is OPTIONAL and its absence must keep the
    // previous behaviour exactly. Proven by the cookie client being reached.
    await expect(getKpiForDay("2026-08-31", "rep-1")).rejects.toThrow(/cookie client reached/);
    expect(cookieClientUsed.count).toBe(1);
  });
});
