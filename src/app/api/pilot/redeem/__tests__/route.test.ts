import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/pilot/redeem — redeems a single-use pilot code, creating a company + attaching the caller
 * as admin (via the SECURITY DEFINER redeem_pilot_code RPC, whose single-use race-safety is enforced
 * in SQL). Previously untested at the route layer. Pins: the sign-in gate (401), the required
 * code + company-name validation (400), the RPC error surfaced as a friendly 422 (the RPC raises
 * human-readable messages like "already been used"), and the success shape (companyId + module +
 * landing).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

function fakeSb(o: { user?: { id: string } | null; rpcData?: unknown; rpcErr?: unknown }) {
  return {
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1" } : o.user } }) },
    rpc: async () => ({ data: o.rpcData ?? null, error: o.rpcErr ?? null }),
  };
}
const mock = (sb: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/pilot/redeem", () => {
  it("401 when not signed in (must sign up before redeeming)", async () => {
    mock(fakeSb({ user: null }));
    expect((await POST(req({ code: "ABC", companyName: "Acme" }))).status).toBe(401);
  });

  it("400 when the access code is missing/blank", async () => {
    mock(fakeSb({}));
    expect((await POST(req({ companyName: "Acme" }))).status).toBe(400);
    expect((await POST(req({ code: "   ", companyName: "Acme" }))).status).toBe(400);
  });

  it("400 when the company name is missing/blank", async () => {
    mock(fakeSb({}));
    expect((await POST(req({ code: "ABC" }))).status).toBe(400);
  });

  it("422 surfacing the RPC's friendly message (e.g. code already used)", async () => {
    mock(fakeSb({ rpcErr: { message: "This access code has already been used" } }));
    const res = await POST(req({ code: "ABC", companyName: "Acme" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/already been used/i);
  });

  it("200 with { companyId, module, landing } on a successful redemption", async () => {
    mock(fakeSb({ rpcData: { company_id: "co-1", module: "care" } }));
    const res = await POST(req({ code: "ABC", companyName: "Acme", fullName: "Jane" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.companyId).toBe("co-1");
    expect(body.module).toBe("care");
    expect(typeof body.landing).toBe("string");
  });
});
