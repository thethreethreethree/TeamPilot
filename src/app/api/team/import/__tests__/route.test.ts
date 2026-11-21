import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/team/createInvitation", () => ({ createInvitation: vi.fn(async () => ({ ok: true, invitationId: "i1", code: "CODE" })) }));
const db = vi.hoisted(() => ({ profiles: [] as unknown[], updates: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({
  findAuthUsersByEmails: vi.fn(async () => new Map([["ann@x.com", ["u-ann"]], ["boss@x.com", ["u-boss"]]])),
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "gt"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: table === "profiles" ? db.profiles : [], error: null });
      b.update = (row: unknown) => {
        db.updates.push(row);
        const u: Record<string, unknown> = {};
        u.eq = () => u;
        u.then = (res: (v: unknown) => unknown) => res({ error: null });
        return u;
      };
      return b;
    },
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createInvitation } from "@/lib/team/createInvitation";
import { POST } from "../route";

const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;
const P = (id: string, manager: string | null) => ({ id, company_id: "co1", manager_id: manager, role: "Member", sales_coach_role: "staff", status: "active" });

beforeEach(() => {
  vi.clearAllMocks();
  db.updates = [];
  db.profiles = [P("u-ann", null), P("u-boss", null)];
  vi.mocked(getCurrentAuthContext).mockResolvedValue({ userId: "admin", companyId: "co1", isAdmin: true } as never);
});

describe("POST /api/team/import", () => {
  it("a non-admin is refused", async () => {
    vi.mocked(getCurrentAuthContext).mockResolvedValue({ userId: "m", companyId: "co1", isAdmin: false } as never);
    expect((await POST(post({ csv: "email\na@x.com", apply: true }))).status).toBe(403);
  });
  it("a preview writes nothing", async () => {
    const body = await (await POST(post({ csv: "email,manager_email\nann@x.com,boss@x.com\nnew@x.com,", apply: false }))).json();
    expect(body.plan.map((p: { person: string; manager: string }) => [p.person, p.manager])).toEqual([["member", "set"], ["invite", "none"]]);
    expect(createInvitation).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
  });
  it("a file with any bad row imports nothing", async () => {
    const res = await POST(post({ csv: "email\nnew@x.com\nnot-an-email", apply: true }));
    expect(res.status).toBe(400);
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it("apply: invites the new person through createInvitation and sets the member's manager", async () => {
    const body = await (await POST(post({ csv: "email,role,manager_email\nann@x.com,,boss@x.com\nnew@x.com,Lead,", apply: true }))).json();
    expect(createInvitation).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", userId: "admin" }), "new@x.com", "Lead", { managerId: null, knownAccountIds: [] });
    expect(db.updates).toEqual([{ manager_id: "u-boss" }]);
    expect(body.results).toEqual([
      { line: 2, email: "ann@x.com", ok: true, result: "now reports to boss@x.com" },
      { line: 3, email: "new@x.com", ok: true, result: "invited", inviteCode: "CODE" },
    ]);
  });
  it("a reporting loop in the file is refused for that row; nothing is written for it", async () => {
    db.profiles = [P("u-ann", null), P("u-boss", "u-ann")]; // boss already reports to ann
    const body = await (await POST(post({ csv: "email,manager_email\nann@x.com,boss@x.com", apply: true }))).json();
    expect(body.plan[0].manager).toBe("loop");
    expect(db.updates).toEqual([]);
  });

  it("a new person whose manager is on the team: the invitation carries the manager (0288)", async () => {
    vi.mocked(createInvitation).mockResolvedValueOnce({ ok: true, invitationId: "i2", code: "C2", managerCarried: true });
    const body = await (await POST(post({ csv: "email,manager_email\nnew@x.com,boss@x.com", apply: true }))).json();
    expect(createInvitation).toHaveBeenCalledWith(expect.anything(), "new@x.com", "Member", { managerId: "u-boss", knownAccountIds: [] });
    expect(body.results[0].result).toBe("invited; will report to boss@x.com when they join");
    expect(db.updates).toEqual([]);
  });
});
