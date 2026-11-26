import { describe, it, expect } from "vitest";
import { teamMembers, teamsIn, teamFromRequest } from "../teamScope";
import type { Person } from "../access";

const P = (id: string, managerId: string | null): Person => ({ id, companyId: "co1", managerId, isCompanyAdmin: false, isSalesCoachManager: !!managerId });
// ceo ← vp ← (m1 ← r1, r2), (m2 ← r3)
const PEOPLE = [P("ceo", null), P("vp", "ceo"), P("m1", "vp"), P("m2", "vp"), P("r1", "m1"), P("r2", "m1"), P("r3", "m2")];
const ID = { m1: "11111111-1111-4111-8111-111111111111" };

describe("team scope (F10.9 / F16.6)", () => {
  it("a team is its manager and everyone below them, at any depth", () => {
    expect([...teamMembers("m1", PEOPLE)].sort()).toEqual(["m1", "r1", "r2"]);
    expect([...teamMembers("vp", PEOPLE)].sort()).toEqual(["m1", "m2", "r1", "r2", "r3", "vp"]);
  });
  it("teams are the people with reports, with their size; a loop isn't offered", () => {
    expect(teamsIn(PEOPLE).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "ceo", size: 7 }, { id: "m1", size: 3 }, { id: "m2", size: 2 }, { id: "vp", size: 6 },
    ]);
    expect(teamsIn([P("a", "b"), P("b", "a")])).toEqual([]);
  });
  const people = [{ ...P(ID.m1, null) }, { ...P("r9", ID.m1) }];
  const admin = () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.then = (res: (v: unknown) => unknown) => res({ data: people.map((p) => ({ id: p.id, company_id: "co1", manager_id: p.managerId, role: "Member", sales_coach_role: null })), error: null });
      return q;
    },
  }) as never;
  const req = (q: string) => new Request(`http://x/api?${q}`);
  it("no team → no narrowing, and the database isn't read", async () => {
    let read = false;
    expect(await teamFromRequest(req(""), () => ((read = true), admin()), "co1", async () => true)).toEqual({ ok: true, members: null });
    expect(read).toBe(false);
  });
  it("a bad id is 400; a manager the caller can't see is 404 (nothing read); a visible one narrows", async () => {
    expect(await teamFromRequest(req("team=nope"), admin, "co1", async () => true)).toMatchObject({ ok: false, status: 400 });
    let read = false;
    expect(await teamFromRequest(req(`team=${ID.m1}`), () => ((read = true), admin()), "co1", async () => false)).toMatchObject({ ok: false, status: 404 });
    expect(read).toBe(false);
    // The tree couldn't be asked: 503 "couldn't check", never 404 "not found" (2026-11-26); nothing read.
    expect(await teamFromRequest(req(`team=${ID.m1}`), () => ((read = true), admin()), "co1", async () => null)).toMatchObject({ ok: false, status: 503 });
    expect(read).toBe(false);
    const ok = await teamFromRequest(req(`team=${ID.m1}`), admin, "co1", async () => true);
    expect(ok.ok && [...ok.members!].sort()).toEqual([ID.m1, "r9"].sort());
    expect(await teamFromRequest(req("team=22222222-2222-4222-8222-222222222222"), admin, "co1", async () => true)).toMatchObject({ ok: false, status: 404 });
  });
});
