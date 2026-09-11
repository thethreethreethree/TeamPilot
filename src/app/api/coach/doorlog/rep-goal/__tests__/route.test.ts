import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * rep-goal route — the manager gate is the security boundary: a REP must not be able to set a daily goal
 * (their own or anyone's). Pins: non-manager PATCH → 403 and no write; manager PATCH → upsert on the rep's row.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { GET, PATCH } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const req = () => ({ url: "https://x/api/coach/doorlog/rep-goal" }) as unknown as Parameters<typeof PATCH>[0];

/** profile = the caller's role row; captures any upsert. */
function client(userId: string | null, profile: Record<string, unknown> | null, opts: { selectGoal?: number | null; selectValueCents?: number | null; repProfile?: Record<string, unknown> | null } = {}) {
  const captured: { upsert?: Record<string, unknown> } = {};
  // The target-rep company check reuses `profile` unless `repProfile` is given (even as null), so the caller's
  // role lookup (id = userId) and the target-rep lookup (id = repId) can differ — how a cross-company rep is tested.
  const repProfile = "repProfile" in opts ? opts.repProfile ?? null : profile;
  return {
    captured,
    sb: {
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
      from: (table: string) => ({
        select: () => ({ eq: (_col: string, val: string) => ({ maybeSingle: async () =>
          table === "profiles"
            ? { data: val === userId ? profile : repProfile, error: null }
            : { data: opts.selectGoal == null ? null : { sales_goal: opts.selectGoal, sale_value_cents: opts.selectValueCents ?? null }, error: null } }) }),
        upsert: (row: Record<string, unknown>) => { captured.upsert = row; return Promise.resolve({ error: null }); },
      }),
    },
  };
}

const MANAGER = { role: "admin", sales_coach_role: null, company_id: "co1" };
const REP = { role: "member", sales_coach_role: null, company_id: "co1" };

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/coach/doorlog/rep-goal — manager gate", () => {
  it("a REP (non-manager) is 403'd and NO goal is written", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000001", salesGoal: 2 });
    const c = client("rep1", REP);
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await PATCH(req());
    expect(res.status).toBe(403);
    expect(c.captured.upsert).toBeUndefined();
  });

  it("a MANAGER sets a rep's goal → upsert on that rep's row, company pinned", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000001", salesGoal: 3 });
    const c = client("boss", MANAGER);
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await PATCH(req());
    expect(res.status).toBe(200);
    expect(c.captured.upsert).toMatchObject({ rep_id: "00000000-0000-0000-0000-000000000001", sales_goal: 3, company_id: "co1", set_by: "boss" });
  });

  it("a MANAGER can set the $-per-sale (cents) alongside the goal", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000001", salesGoal: 2, saleValueCents: 18500 });
    const c = client("boss", MANAGER);
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await PATCH(req());
    expect(res.status).toBe(200);
    expect(c.captured.upsert).toMatchObject({ sales_goal: 2, sale_value_cents: 18500 });
    expect(await res.json()).toMatchObject({ salesGoal: 2, saleValueCents: 18500 });
  });

  it("a MANAGER cannot set a goal for a rep in ANOTHER company → 403, no write (cross-tenant guard)", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000009", salesGoal: 3 });
    const c = client("boss", MANAGER, { repProfile: { company_id: "co2" } }); // target rep is in co2, caller in co1
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await PATCH(req());
    expect(res.status).toBe(403);
    expect(c.captured.upsert).toBeUndefined();
  });

  it("a MANAGER is 403'd when the target rep profile is missing (unknown/foreign id)", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000009", salesGoal: 3 });
    const c = client("boss", MANAGER, { repProfile: null });
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await PATCH(req());
    expect(res.status).toBe(403);
    expect(c.captured.upsert).toBeUndefined();
  });

  it("401 when unauthenticated", async () => {
    asMock(readBody).mockResolvedValue({ repId: "00000000-0000-0000-0000-000000000001", salesGoal: 2 });
    asMock(createClient).mockResolvedValue(client(null, null).sb);
    expect((await PATCH(req())).status).toBe(401);
  });
});

describe("GET /api/coach/doorlog/rep-goal", () => {
  it("returns the rep's current goal + $-per-sale", async () => {
    asMock(createClient).mockResolvedValue(client("rep1", REP, { selectGoal: 2, selectValueCents: 18500 }).sb);
    expect(await (await GET(req())).json()).toEqual({ salesGoal: 2, saleValueCents: 18500 });
  });
  it("null when none set", async () => {
    asMock(createClient).mockResolvedValue(client("rep1", REP, { selectGoal: null }).sb);
    expect(await (await GET(req())).json()).toEqual({ salesGoal: null, saleValueCents: null });
  });
});
