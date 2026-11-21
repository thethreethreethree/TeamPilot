import { describe, it, expect, vi, beforeEach } from "vitest";

// Review #3 (0296 round): the CSV import passes the accounts it already looked up, so createInvitation must not page
// through auth.users once per row (200 rows × a full listing ran past maxDuration and stopped the import halfway).
vi.mock("@/lib/supabase/admin", () => ({ findAuthUserByEmail: vi.fn(async () => null) }));

import { findAuthUserByEmail } from "@/lib/supabase/admin";
import { createInvitation } from "../createInvitation";

const db = vi.hoisted(() => ({ member: null as null | { id: string; full_name: string; status: string }, inserts: [] as unknown[] }));

const supabase = () =>
  ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: table === "profiles" ? db.member : null, error: null });
      b.insert = (row: unknown) => {
        db.inserts.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "i1", code: "C" }, error: null }) }) };
      };
      return b;
    },
  }) as never;

const caller = () => ({ supabase: supabase(), companyId: "co1", userId: "admin" });

beforeEach(() => {
  vi.clearAllMocks();
  db.member = null;
  db.inserts = [];
});

describe("createInvitation — account lookup", () => {
  it("a single invite (no knownAccountIds) looks the email up itself", async () => {
    await createInvitation(caller(), "New@X.com", "Member");
    expect(findAuthUserByEmail).toHaveBeenCalledWith("new@x.com");
  });
  it("knownAccountIds: [] → no lookup, invited", async () => {
    const r = await createInvitation(caller(), "new@x.com", "Member", { knownAccountIds: [] });
    expect(findAuthUserByEmail).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true });
    expect(db.inserts).toHaveLength(1);
  });
  it("knownAccountIds naming an active member → still refused as already a member, without a lookup", async () => {
    db.member = { id: "u1", full_name: "Ann", status: "active" };
    const r = await createInvitation(caller(), "ann@x.com", "Member", { knownAccountIds: ["u1"] });
    expect(findAuthUserByEmail).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(db.inserts).toEqual([]);
  });
});
