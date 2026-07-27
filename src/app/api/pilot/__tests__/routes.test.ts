import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Layer-2 tests for the pilot-code routes. The RPCs themselves are runtime-verified against the
 * live DB; these lock the ROUTE logic that sits above them — input validation, the module→landing
 * mapping (a workflow-continuity contract: a redeemer must land in their module, AMD-006 L3), and
 * error/authn passthrough — which the RPC-level test cannot cover.
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

import { POST as validate } from "@/app/api/pilot/validate/route";
import { POST as redeem } from "@/app/api/pilot/redeem/route";

const req = (body: unknown) =>
  ({ json: async () => body, headers: { get: () => null } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST /api/pilot/validate", () => {
  it("400 when code is missing/blank", async () => {
    expect((await validate(req({}))).status).toBe(400);
    expect((await validate(req({ code: "   " }))).status).toBe(400);
  });

  it("passes the validator result through on success", async () => {
    rpc.mockResolvedValue({ data: { valid: true, module: "care", redeemed: false }, error: null });
    const res = await validate(req({ code: "ABC1234" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, module: "care", redeemed: false });
    expect(rpc).toHaveBeenCalledWith("pilot_code_status", { p_code: "ABC1234" });
  });

  it("500 on a DB error (does not leak the raw error)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await validate(req({ code: "ABC1234" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toContain("boom");
  });
});

describe("POST /api/pilot/redeem", () => {
  it("401 when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await redeem(req({ code: "X", companyName: "Y" }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400 when code or company name is missing", async () => {
    expect((await redeem(req({ companyName: "Y" }))).status).toBe(400);
    expect((await redeem(req({ code: "X" }))).status).toBe(400);
  });

  it.each([
    ["elostate", "/dashboard"],
    ["care", "/dashboard/care"],
    ["sales_coach", "/dashboard/sales-coach"],
  ])("maps module %s → landing %s", async (module, landing) => {
    rpc.mockResolvedValue({ data: { company_id: "c1", module }, error: null });
    const res = await redeem(req({ code: "X", companyName: "Acme", fullName: "Jo" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ companyId: "c1", module, landing });
  });

  it("surfaces the RPC's human-readable error as 422 (e.g. already used)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This access code has already been used" } });
    const res = await redeem(req({ code: "X", companyName: "Acme" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("This access code has already been used");
  });

  it("defaults landing to /dashboard if the RPC omits a module", async () => {
    rpc.mockResolvedValue({ data: { company_id: "c1" }, error: null });
    const res = await redeem(req({ code: "X", companyName: "Acme" }));
    expect((await res.json()).landing).toBe("/dashboard");
  });
});
