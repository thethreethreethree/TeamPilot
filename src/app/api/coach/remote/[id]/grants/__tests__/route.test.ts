import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const who = vi.hoisted(() => ({ ctx: { userId: "adm", companyId: "co1", isAdmin: true } as unknown }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => who.ctx) }));
const st = vi.hoisted(() => ({ grants: [] as unknown[], inserts: [] as Array<{ t: string; row: unknown }>, audits: [] as unknown[], session: { id: "s1", agent_id: "rep1", context: "phone", client_label: "Acme" } as unknown, member: { id: "u2", full_name: "Tia", status: "active" } as unknown }));
vi.mock("@/lib/coach/remote/callGrants", () => ({ grantsForCall: vi.fn(async () => st.grants) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async (_a: unknown, e: unknown) => (st.audits.push(e), true)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: t === "coaching_sessions" ? st.session : t === "profiles" ? st.member : { id: "g-new" }, error: null });
      q.insert = (row: unknown) => {
        st.inserts.push({ t, row });
        const r: Record<string, unknown> = { select: () => r, maybeSingle: async () => ({ data: { id: "g-new" }, error: null }) };
        r.then = (res: (v: unknown) => unknown) => res({ error: null });
        return r;
      };
      return q;
    },
  }),
}));
import { POST, DELETE } from "../route";

const post = async (body: unknown): Promise<Response> => (await POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) })) as Response;
const del = async (body: unknown): Promise<Response> => (await DELETE(new Request("http://x", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) })) as Response;
const U2 = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  who.ctx = { userId: "adm", companyId: "co1", isAdmin: true };
  st.grants = [];
  st.inserts = [];
  st.audits = [];
  st.session = { id: "s1", agent_id: "rep1", context: "phone", client_label: "Acme" };
  st.member = { id: U2, full_name: "Tia", status: "active" };
});

describe("call grants (0336)", () => {
  it("not an admin → 403, nothing written", async () => {
    who.ctx = { userId: "m", companyId: "co1", isAdmin: false };
    expect((await post({ granteeId: U2, reason: "training" })).status).toBe(403);
    expect(st.inserts).toEqual([]);
  });
  it("a call outside the company (or not phone/video) → 404", async () => {
    st.session = null;
    expect((await post({ granteeId: U2, reason: "training" })).status).toBe(404);
  });
  it("grants with a reason, tells the rep and the teammate, and audits", async () => {
    expect((await post({ granteeId: U2, reason: "training example" })).status).toBe(201);
    expect(st.inserts.find((i) => i.t === "call_access_grants")!.row).toMatchObject({ company_id: "co1", session_id: "s1", grantee_id: U2, granted_by: "adm", reason: "training example" });
    const notes = st.inserts.filter((i) => i.t === "manager_notifications").map((i) => i.row as { recipient_id: string; payload: { role: string } });
    expect(notes.map((n) => [n.recipient_id, n.payload.role])).toEqual([["rep1", "rep"], [U2, "grantee"]]);
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.grant" })]);
  });
  it("the call's own rep, or someone already granted, is refused", async () => {
    st.session = { id: "s1", agent_id: U2, context: "phone", client_label: "Acme" }; // U2 is this call's rep
    expect((await post({ granteeId: U2, reason: "x" })).status).toBe(400);
    expect(st.inserts).toEqual([]);
    st.session = { id: "s1", agent_id: "rep1", context: "phone", client_label: "Acme" };
    st.grants = [{ id: "g1", granteeId: U2, active: true }];
    st.member = { id: U2, full_name: "Tia", status: "active" };
    expect((await post({ granteeId: U2, reason: "x" })).status).toBe(409);
  });
  it("revoke writes a revocation and audits it", async () => {
    st.grants = [{ id: "33333333-3333-4333-8333-333333333333", granteeId: U2, active: true }];
    expect((await del({ grantId: "33333333-3333-4333-8333-333333333333" })).status).toBe(200);
    expect(st.inserts).toContainEqual({ t: "call_access_revocations", row: { grant_id: "33333333-3333-4333-8333-333333333333", company_id: "co1", revoked_by: "adm" } });
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.grant_revoke" })]);
  });
});
