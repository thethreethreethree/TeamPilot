import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/team/createInvitation", () => ({ createInvitation: vi.fn(async () => ({ ok: true, invitationId: "i1", code: "CODE" })) }));
vi.mock("@/lib/team/setMemberRole", () => ({ setMemberRole: vi.fn(async () => ({ ok: true, from: "Member" })) }));
const calls = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("@/lib/team/removeMember", () => ({ removeMember: vi.fn(async (_sb: unknown, _co: string, _actor: string, id: string) => (calls.order.push(`remove:${id}`), id === "u-boss" ? { ok: false, status: 409, error: "This is your company's only admin — make someone else an admin first." } : { ok: true })) }));
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
import { removeMember } from "@/lib/team/removeMember";
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

  it("role change for an existing member: shown in the preview, applied through setMemberRole (F2.8)", async () => {
    const { setMemberRole } = await import("@/lib/team/setMemberRole");
    const preview = await (await POST(post({ csv: "email,role\nann@x.com,Manager", apply: false }))).json();
    expect(preview.plan[0].roleChange).toEqual({ from: "Member", to: "Manager" });
    expect(setMemberRole).not.toHaveBeenCalled();
    const done = await (await POST(post({ csv: "email,role\nann@x.com,Manager", apply: true }))).json();
    expect(setMemberRole).toHaveBeenCalledWith(expect.anything(), "co1", "u-ann", "Manager");
    expect(done.results).toContainEqual(expect.objectContaining({ email: "ann@x.com", ok: true, result: "role: Member → Manager" }));
  });
  it("the same role: no change", async () => {
    const { setMemberRole } = await import("@/lib/team/setMemberRole");
    await POST(post({ csv: "email,role\nann@x.com,Member", apply: true }));
    expect(setMemberRole).not.toHaveBeenCalled();
  });
  it("2026-11-26: a remove row previews who reports to them, and removals run last through removeMember", async () => {
    db.profiles = [P("u-ann", "u-boss"), P("u-boss", null)];
    const preview = await (await POST(post({ csv: "email,action\nboss@x.com,remove\nnew@x.com,remove", apply: false }))).json();
    expect(preview.plan.map((p: { email: string; removal: string; reportsTo: number }) => [p.email, p.removal, p.reportsTo])).toEqual([["boss@x.com", "remove", 1], ["new@x.com", "not_member", 0]]);
    expect(removeMember).not.toHaveBeenCalled();
    calls.order = [];
    const body = await (await POST(post({ csv: "email,action,manager_email\nboss@x.com,remove,\nann@x.com,,boss@x.com\nnew@x.com,remove,", apply: true }))).json();
    expect(createInvitation).not.toHaveBeenCalledWith(expect.anything(), "new@x.com", expect.anything(), expect.anything()); // a remove row never invites
    expect(calls.order).toEqual(["remove:u-boss"]);
    expect(body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: "boss@x.com", ok: false, result: expect.stringMatching(/only admin/) }),
      expect.objectContaining({ email: "new@x.com", ok: false, result: "Not on your team — nothing to remove." }),
    ]));
  });
});
