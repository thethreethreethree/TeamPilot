import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/:id/brief — Macro Mode's Highlights / Next Meeting. Pinned: in-person calls have no brief; who
 * may act (isOwner); a failed review or prospect read is "couldn't read", never "unreviewed" or "not in the pipeline"
 * (each would invite a second review or a duplicate prospect) — 2026-11-23.
 */
type A = { data: unknown; error: { message: string; code?: string } | null };
const st = vi.hoisted(() => ({ session: null as null | Record<string, unknown>, answers: {} as Record<string, A> }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/coach/remote/callBrief", () => ({ runCallBrief: vi.fn(), briefFromRow: (r: { id: string }) => ({ id: r.id }) }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => st.answers[table] ?? { data: null, error: null };
      return q;
    },
  }),
}));

import { GET } from "../route";

const CALL = "11111111-1111-4111-8111-111111111111";
const get = () => GET(new Request("http://x") as never, { params: Promise.resolve({ id: CALL }) });
const boom = { data: null, error: { message: "boom" } };

beforeEach(() => {
  st.session = { id: CALL, context: "video", agentId: "rep-1", clientLabel: "Pat" };
  st.answers = {
    remote_call_briefs: { data: { id: "b1" }, error: null },
    remote_prospect_calls: { data: { prospect_id: "p1" }, error: null },
    remote_prospects_current: { data: { id: "p1", name: "Pat", status: "open", next_call_date: null }, error: null },
    remote_checklist_reviews: { data: null, error: null },
  };
});

describe("call brief", () => {
  it("returns the brief, its prospect and that the caller is the call's rep", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ remote: true, brief: { id: "b1" }, prospect: { id: "p1" }, isOwner: true, review: null });
  });

  it("a manager reading it is not the owner (they read; the rep acts)", async () => {
    st.session = { ...st.session, agentId: "someone-else" };
    expect(await (await get()).json()).toMatchObject({ isOwner: false });
  });

  it("an in-person call has no brief", async () => {
    st.session = { ...st.session, context: "in_person" };
    expect(await (await get()).json()).toMatchObject({ remote: false, brief: null });
  });

  for (const table of ["remote_prospect_calls", "remote_prospects_current", "remote_checklist_reviews"]) {
    it(`a failed ${table} read is "couldn't read" (500), never shown as unlinked or unreviewed`, async () => {
      st.answers[table] = boom;
      const res = await get();
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/couldn.t read/i);
    });
  }
});
