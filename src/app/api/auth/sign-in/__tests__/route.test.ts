import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/auth/sign-in (RSS Phase 0 step 7). Pins: every attempt is recorded with a lower-cased email,
 * success or not; Supabase's own message comes back at 400 as the pages always showed it; the lockout rule
 * stands aside while D4 is NOT DECIDED (sign-in is never blocked today); a ledger failure never blocks a
 * sign-in; and a throwing sign-in is a generic 500 (the page then falls back to the direct path).
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

const state = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  insertError: null as { message: string } | null,
  attempts: [] as Array<Record<string, unknown>>,
  signIn: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        gte: async () => ({ data: state.attempts, error: null }),
        insert: async (row: Record<string, unknown>) => {
          if (!state.insertError) state.inserts.push(row);
          return { error: state.insertError };
        },
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: state.signIn } }),
}));

import { POST } from "../route";

const req = (body: unknown) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-real-ip": "203.0.113.7" }),
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  state.inserts = [];
  state.insertError = null;
  state.attempts = [];
  state.signIn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/sign-in", () => {
  it("signs in, records a successful attempt with a lower-cased email and the IP", async () => {
    state.signIn.mockResolvedValue({ error: null });
    const res = await POST(req({ email: "  Rep@Example.COM ", password: "pw" }));
    expect(res.status).toBe(200);
    expect(state.signIn).toHaveBeenCalledWith({ email: "rep@example.com", password: "pw" });
    expect(state.inserts).toEqual([{ email: "rep@example.com", ip: "203.0.113.7", succeeded: true }]);
  });

  it("a wrong password is a 400 with Supabase's own message, recorded as a failure", async () => {
    state.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(req({ email: "rep@example.com", password: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid login credentials");
    expect(state.inserts[0]).toMatchObject({ succeeded: false });
  });

  it("D4 decided (founder 2026-11-22): 5 recent failures lock the account — 429, and the password is never tried", async () => {
    const now = Date.now();
    state.attempts = Array.from({ length: 5 }, (_, i) => ({
      email: "rep@example.com",
      succeeded: false,
      created_at: new Date(now - (i + 1) * 60_000).toISOString(),
    }));
    state.signIn.mockResolvedValue({ error: null });
    const res = await POST(req({ email: "rep@example.com", password: "pw" }));
    expect(res.status).toBe(429);
    expect((await res.json()).locked).toBe(true);
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("failures older than the 60-minute window don't lock", async () => {
    const now = Date.now();
    state.attempts = Array.from({ length: 5 }, (_, i) => ({
      email: "rep@example.com",
      succeeded: false,
      created_at: new Date(now - (61 + i) * 60_000).toISOString(),
    }));
    state.signIn.mockResolvedValue({ error: null });
    expect((await POST(req({ email: "rep@example.com", password: "pw" }))).status).toBe(200);
  });

  it("a ledger failure never blocks the sign-in", async () => {
    state.insertError = { message: "relation login_attempts does not exist" };
    state.signIn.mockResolvedValue({ error: null });
    expect((await POST(req({ email: "rep@example.com", password: "pw" }))).status).toBe(200);
  });

  it("a throwing sign-in is a generic 500 that leaks nothing", async () => {
    state.signIn.mockRejectedValue(new Error("fetch failed: ECONNREFUSED 10.0.0.1"));
    const res = await POST(req({ email: "rep@example.com", password: "pw" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.1/);
  });

  it("a malformed body is a 400 before any sign-in", async () => {
    expect((await POST(req({ email: "", password: "" }))).status).toBe(400);
    expect(state.signIn).not.toHaveBeenCalled();
  });
});
