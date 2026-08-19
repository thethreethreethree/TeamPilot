import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Roster API — the write path that closes RQ6/S2. What these pin: creating staff is MANAGER-ONLY
 * (a non-manager gets 403), company_id is server-resolved (never the body — tenant-pin), and the
 * validation/auth boundaries hold.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function reqWith(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

let insertedRow: Record<string, unknown> | null = null;
function fakeSb() {
  return {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        insertedRow = row;
        return { select: () => ({ single: async () => ({ data: { id: "e1", company_id: row.company_id, name: row.name, role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" }, error: null }) }) };
      },
      select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: [{ id: "e1", company_id: "co1", name: "Ana", role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" }], error: null }) }) }) }),
    }),
  };
}

beforeEach(() => {
  insertedRow = null;
  asMock(createClient).mockResolvedValue(fakeSb());
});

describe("POST /api/schedule/employees — RQ6 manager gate + tenant-pin", () => {
  it("a MANAGER creates a staff member (201) with company_id from the session, not the body", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "co1", role: "admin", isAdmin: true });
    const res = await POST(reqWith({ name: "Ana", companyId: "ATTACKER-CO" }));
    expect(res.status).toBe(201);
    expect(insertedRow?.company_id).toBe("co1"); // server-resolved, ignores the body's companyId
  });

  it("a NON-manager is blocked (403 — RQ6)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "co1", role: "Member", isAdmin: false });
    expect((await POST(reqWith({ name: "Ana" }))).status).toBe(403);
    expect(insertedRow).toBeNull(); // never written
  });

  it("401 when unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(reqWith({ name: "Ana" }))).status).toBe(401);
  });

  it("400 on an invalid body (no name)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "co1", role: "admin", isAdmin: true });
    expect((await POST(reqWith({ role: "nurse" }))).status).toBe(400);
  });
});

describe("GET /api/schedule/employees", () => {
  it("returns the roster for a company member", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "co1", role: "Member", isAdmin: false });
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.employees).toHaveLength(1);
    expect(json.employees[0].name).toBe("Ana");
  });

  it("401 when unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await GET({} as Parameters<typeof GET>[0])).status).toBe(401);
  });
});
