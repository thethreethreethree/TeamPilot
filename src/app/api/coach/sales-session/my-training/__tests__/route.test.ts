import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/my-training — the rep's own training focuses, drawn from their own sales reviews.
 * Previously untested. Pinned here: a review written on one of the rep's meetings or huddles before the sales-only
 * guard is left out (R1-aggregate-reads, 2026-10-13), and a failed lookup degrades instead of counting it.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/data/doorlog", () => ({ getAllTimeKpi: vi.fn(async () => null) }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const req = () => ({}) as Parameters<typeof GET>[0];

const setCaller = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

/** Admin mock that answers by table and records the `.not` filter on the events read. */
let notCalls: unknown[][];
const mockAdmin = (sessions: { data: unknown; error: unknown }) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "in", "eq", "order", "limit"]) chain[m] = () => chain;
      chain.not = (...args: unknown[]) => {
        notCalls.push(args);
        return chain;
      };
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve(table === "coaching_sessions" ? sessions : { data: [], error: null });
      return chain;
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  notCalls = [];
});

describe("GET /my-training", () => {
  it("401 unauthenticated", async () => {
    setCaller(null);
    mockAdmin({ data: [], error: null });
    expect((await GET(req())).status).toBe(401);
  });

  it("leaves out the reviews written on the rep's meetings and huddles", async () => {
    setCaller("rep1");
    mockAdmin({ data: [{ id: "m1" }, { id: "h1" }], error: null });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(notCalls).toContainEqual(["subject", "in", '("sales_session:m1","sales_session:h1")']);
  });

  it("degrades when the meetings lookup fails, rather than counting their reviews", async () => {
    setCaller("rep1");
    mockAdmin({ data: null, error: { message: "boom" } });
    expect(await (await GET(req())).json()).toEqual({ degraded: true });
  });
});
