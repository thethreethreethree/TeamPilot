import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/meeting-session/trend — 401 unauth, 403 no company, and a company-pinned aggregate of the
 * meeting.dissect_generated events into a trend. The aggregation itself is tested in aggregateMeetingDissects;
 * here we assert the route auth + the company pin + that it returns the trend shape.
 */
const state = vi.hoisted(() => ({ rows: [] as unknown[], eqCalls: [] as Array<[string, unknown]> }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (col: string, val: unknown) => { state.eqCalls.push([col, val]); return b; };
      b.order = () => b;
      b.limit = async () => ({ data: state.rows, error: null });
      return b;
    },
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
function setAuth(userId: string | null) {
  asMock(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } });
}
const good = { decisions: [{ decision: "d" }], actions: [{ action: "a", owner: "Dana" }], open_items: [], effectiveness: { focused: true } };

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.eqCalls = [];
  setAuth("u1");
  asMock(getCurrentCompanyId).mockResolvedValue("co1");
});

describe("GET meeting-session trend", () => {
  it("401 unauthenticated", async () => { setAuth(null); expect((await GET()).status).toBe(401); });

  it("403 when there is no company context", async () => {
    asMock(getCurrentCompanyId).mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
  });

  it("returns a company-pinned trend aggregate", async () => {
    state.rows = [good, good, good, good].map((p) => ({ payload: p, created_at: "2026-08-22T00:00:00Z" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trend.overall.meetings).toBe(4);
    expect(json.trend.direction).toBeDefined();
    // company pin (INV15)
    expect(state.eqCalls).toContainEqual(["company_id", "co1"]);
    expect(state.eqCalls).toContainEqual(["kind", "meeting.dissect_generated"]);
  });

  it("returns 'insufficient' honestly when there are few meetings", async () => {
    state.rows = [{ payload: good, created_at: "2026-08-22T00:00:00Z" }];
    const json = await (await GET()).json();
    expect(json.trend.direction).toBe("insufficient");
  });
});
