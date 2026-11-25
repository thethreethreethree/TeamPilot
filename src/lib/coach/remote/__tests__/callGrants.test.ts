import { describe, it, expect } from "vitest";
import { activeGrant, grantsForCall } from "../callGrants";

function db(grants: unknown[], revoked: string[], filters: Array<[string, string, unknown]> = []) {
  return {
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "in"]) q[m] = () => q;
      q.eq = (k: string, v: unknown) => (filters.push([t, k, v]), q);
      q.then = (res: (v: unknown) => unknown) => res({ data: t === "call_access_grants" ? grants : revoked.map((g) => ({ grant_id: g })), error: null });
      return q;
    },
  } as never;
}
const G = (id: string, grantee: string) => ({ id, session_id: "s1", grantee_id: grantee, granted_by: "adm", reason: "training", created_at: "2026-11-25T00:00:00Z" });

describe("callGrants (0336)", () => {
  it("a grant is active until revoked; the viewer must be the grantee", async () => {
    expect(await activeGrant(db([G("g1", "u1")], []), "co1", "s1", "u1")).toMatchObject({ id: "g1", active: true });
    expect(await activeGrant(db([G("g1", "u1")], ["g1"]), "co1", "s1", "u1")).toBeNull();
    expect(await activeGrant(db([G("g1", "u1")], []), "co1", "s1", "someone-else")).toBeNull();
  });
  it("reads are pinned to the company", async () => {
    const filters: Array<[string, string, unknown]> = [];
    await grantsForCall(db([G("g1", "u1")], [], filters), "co1", "s1");
    expect(filters).toContainEqual(["call_access_grants", "company_id", "co1"]);
    expect(filters).toContainEqual(["call_access_revocations", "company_id", "co1"]);
  });
});
