import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/departments — create a department. Previously untested. Pins the ADMIN-ONLY gate (a
 * non-admin, or an unauthenticated caller, gets 403 and createDepartment is never called — org
 * structure is leadership-managed) and the 1-80 char name validation.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/departments", () => ({
  listDepartments: vi.fn(async () => []),
  createDepartment: vi.fn(async () => ({ id: "d1", name: "Sales" })),
  renameDepartment: vi.fn(),
  archiveDepartment: vi.fn(),
  unarchiveDepartment: vi.fn(),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createDepartment } from "@/lib/data/departments";
import { POST } from "../route";

const setAuth = (a: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(a);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/departments — admin gate + name validation", () => {
  it("403 for a non-admin caller (no create)", async () => {
    setAuth({ isAdmin: false, companyId: "co1" });
    const res = await POST(req({ name: "Sales" }));
    expect(res.status).toBe(403);
    expect(createDepartment).not.toHaveBeenCalled();
  });

  it("403 when unauthenticated (POST is admin-only)", async () => {
    setAuth(null);
    expect((await POST(req({ name: "Sales" }))).status).toBe(403);
    expect(createDepartment).not.toHaveBeenCalled();
  });

  it("400 when the name is empty or > 80 chars", async () => {
    setAuth({ isAdmin: true, companyId: "co1" });
    expect((await POST(req({ name: "   " }))).status).toBe(400);
    expect((await POST(req({ name: "x".repeat(81) }))).status).toBe(400);
    expect(createDepartment).not.toHaveBeenCalled();
  });

  it("200 for an admin with a valid name — creates the department", async () => {
    setAuth({ isAdmin: true, companyId: "co1" });
    const res = await POST(req({ name: "Sales", description: "The sales team" }));
    expect(res.status).toBe(200);
    expect((await res.json()).department).toMatchObject({ id: "d1" });
    expect(createDepartment).toHaveBeenCalledWith({ name: "Sales", description: "The sales team" });
  });
});
