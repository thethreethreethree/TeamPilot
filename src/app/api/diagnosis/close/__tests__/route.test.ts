import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/diagnosis/close — the close-the-loop route (calls the atomic close_problem RPC). Previously
 * untested. Pins: the validation gates (problemId, action, reasoning >= 40 chars — "a resolution without a
 * stated WHY is incomplete"), the happy path returning the resolutionId, and that neither the RPC-error path
 * NOR the catch block leaks a raw error (CWE-209 — the catch was a two-step leak the sweep grep missed).
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

// Default: an authenticated user (the real caller is the signed-in dashboard). Pass
// `{ user: null }` to simulate an anon caller and exercise the auth gate.
const setRpc = (result: { data?: unknown; error?: unknown; user?: unknown }) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: "user" in result ? result.user : { id: "u1" } } }) },
    rpc: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  });

const req = (body: unknown) =>
  ({ json: async () => { if (body instanceof Error) throw body; return body; } }) as unknown as Parameters<typeof POST>[0];

const OK = { problemId: "p1", action: "Re-scoped the sprint", reasoning: "The root cause was an unowned dependency, now assigned to a named owner." };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/diagnosis/close", () => {
  it("401 for an anonymous caller — the append-only resolutions+events chain is not anon-writable", async () => {
    // Detection test for the 2026-07-31 auth-gate fix: without a signed-in user the route must
    // reject BEFORE the close_problem RPC (no write to the §3.1 chain). Sibling-parity with
    // outside-view / ripple-trace. If the gate is removed this returns 400/200 instead of 401.
    let rpcCalled = false;
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      rpc: async () => { rpcCalled = true; return { data: "res-x", error: null }; },
    });
    const res = await POST(req(OK));
    expect(res.status).toBe(401);
    expect(rpcCalled).toBe(false);
  });

  it("400 when problemId is missing", async () => {
    setRpc({});
    expect((await POST(req({ action: "x", reasoning: "a".repeat(40) }))).status).toBe(400);
  });

  it("400 when reasoning is shorter than 40 chars (a WHY is required)", async () => {
    setRpc({});
    expect((await POST(req({ problemId: "p1", action: "x", reasoning: "too short" }))).status).toBe(400);
  });

  it("200 returns the resolutionId from the RPC", async () => {
    setRpc({ data: "res-1" });
    const res = await POST(req(OK));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resolutionId: "res-1" });
  });

  it("500 on an RPC error WITHOUT leaking the raw message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRpc({ error: { message: "internal pg detail: close_problem raised" } });
    const res = await POST(req(OK));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });

  it("500 in the catch block WITHOUT leaking the thrown message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRpc({});
    const res = await POST(req(new Error("internal detail: json parse blew up")));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal detail");
  });
});
