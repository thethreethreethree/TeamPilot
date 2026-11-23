import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST /api/me/mfa/verify — multi-factor sign-in's code check (2026-11-23). */
const st = vi.hoisted(() => ({
  user: { id: "u1", app_metadata: {} as Record<string, unknown> } as null | { id: string; app_metadata: Record<string, unknown> },
  factors: { all: [] as unknown[], totp: [] as unknown[] },
  verifyError: null as null | { message: string },
  challenged: [] as Array<{ factorId: string; code: string }>,
  refreshed: 0,
  flag: [] as boolean[],
  flagOk: true,
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/auth/mfaFlag", () => ({ setMfaFlag: vi.fn(async (_a: unknown, _u: string, on: boolean) => (st.flag.push(on), st.flagOk)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) }) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: st.user } }),
      refreshSession: async () => (st.refreshed++, {}),
      mfa: {
        listFactors: async () => ({ data: st.factors, error: null }),
        challengeAndVerify: async (a: { factorId: string; code: string }) => (st.challenged.push(a), { error: st.verifyError }),
      },
    },
  }),
}));

import { POST } from "../route";
const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never);
const VERIFIED = { id: "f1", factor_type: "totp", status: "verified" };
const NEW = { id: "f2", factor_type: "totp", status: "unverified" };

beforeEach(() => {
  st.user = { id: "u1", app_metadata: {} };
  st.factors = { all: [VERIFIED, NEW], totp: [VERIFIED] };
  st.verifyError = null;
  st.challenged = [];
  st.refreshed = 0;
  st.flag = [];
  st.flagOk = true;
});

describe("checking a sign-in code", () => {
  it("signed out → 401", async () => {
    st.user = null;
    expect((await post({ code: "123456" })).status).toBe(401);
  });

  it("anything but 6 digits is refused before any check", async () => {
    for (const code of ["12345", "abcdef", "1234567", ""]) expect((await post({ code })).status).toBe(400);
    expect(st.challenged).toEqual([]);
  });

  it("a wrong code turns nothing on", async () => {
    st.verifyError = { message: "Invalid TOTP code entered" };
    const res = await post({ code: "123 456" });
    expect(res.status).toBe(400);
    expect(st.flag).toEqual([]);
  });

  it("finishing setup: the new factor is checked, the guard turned on, the session refreshed", async () => {
    const res = await post({ code: "123456", factorId: "f2" });
    expect(res.status).toBe(200);
    expect(st.challenged).toEqual([{ factorId: "f2", code: "123456" }]);
    expect(st.flag).toEqual([true]);
    expect(st.refreshed).toBe(1);
  });

  it("signing in: the verified factor is challenged; an already-on account is not rewritten", async () => {
    st.user = { id: "u1", app_metadata: { mfa: true } };
    const res = await post({ code: "654321" });
    expect(res.status).toBe(200);
    expect(st.challenged).toEqual([{ factorId: "f1", code: "654321" }]);
    expect(st.flag).toEqual([]);
  });

  it("a right code whose flag can't be written says so — never a silent unprotected account", async () => {
    st.flagOk = false;
    const res = await post({ code: "123456", factorId: "f2" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/turning on the requirement failed/i);
  });

  it("no authenticator on the account → 404", async () => {
    st.factors = { all: [], totp: [] };
    expect((await post({ code: "123456" })).status).toBe(404);
  });
});
