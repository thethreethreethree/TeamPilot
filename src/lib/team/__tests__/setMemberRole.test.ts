import { describe, it, expect } from "vitest";
import { setMemberRole } from "../setMemberRole";

/** The one place the role rules live (2026-11-25): company pin and never the last admin. */
function db(target: Record<string, unknown> | null, admins: number) {
  const updates: unknown[] = [];
  return {
    updates,
    sb: {
      from: () => {
        const b: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in"]) b[m] = () => b;
        b.maybeSingle = async () => ({ data: target, error: null });
        b.then = (res: (v: unknown) => unknown) => res({ count: admins, error: null });
        b.update = (row: unknown) => {
          updates.push(row);
          const u: Record<string, unknown> = {};
          u.eq = () => u;
          u.then = (res: (v: unknown) => unknown) => res({ error: null });
          return u;
        };
        return b;
      },
    } as never,
  };
}

describe("setMemberRole", () => {
  it("another company's member is not found, nothing written", async () => {
    const d = db({ id: "u", role: "Member", company_id: "other" }, 2);
    expect(await setMemberRole(d.sb, "co1", "u", "Manager")).toMatchObject({ ok: false, status: 404 });
    expect(d.updates).toEqual([]);
  });
  it("never demotes the last admin", async () => {
    const d = db({ id: "u", role: "CEO", company_id: "co1" }, 1);
    expect(await setMemberRole(d.sb, "co1", "u", "Manager")).toMatchObject({ ok: false, status: 409 });
    expect(d.updates).toEqual([]);
  });
  it("otherwise sets the role and says what it was", async () => {
    const d = db({ id: "u", role: "Member", company_id: "co1" }, 1);
    expect(await setMemberRole(d.sb, "co1", "u", "Manager")).toEqual({ ok: true, from: "Member" });
    expect(d.updates).toEqual([{ role: "Manager" }]);
  });
});
