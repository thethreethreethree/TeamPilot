import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/team/accept — accepts a team invitation as the signed-in user, via the SECURITY DEFINER
 * accept_invitation() RPC (which enforces the email-binding: only the invited email may accept).
 * Previously untested at the route layer. Pins: the sign-in gate (401), the required code (400),
 * the RPC error surfaced as a 422 (the RPC raises human-readable messages like "already accepted"
 * or "this invitation was sent to <email>"), and the success shape ({ companyId }).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

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

describe("POST /api/team/accept", () => {
  it("401 when not signed in", async () => {
    mock(fakeSb({ user: null }));
    expect((await POST(req({ code: "INV123" }))).status).toBe(401);
  });

  it("400 when the invitation code is missing/blank", async () => {
    mock(fakeSb({}));
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ code: "" }))).status).toBe(400);
  });

  it("422 surfacing the RPC's message (email-binding / already-accepted)", async () => {
    mock(
      fakeSb({
        rpcErr: { message: "This invitation was sent to alice@work.com. Sign in with that email address to accept it." },
      })
    );
    const res = await POST(req({ code: "INV123" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/sent to alice@work\.com/i);
  });

  it("200 returning the joined companyId on success", async () => {
    mock(fakeSb({ rpcData: "co-1" }));
    const res = await POST(req({ code: "INV123", fullName: "Alice" }));
    expect(res.status).toBe(200);
    expect((await res.json()).companyId).toBe("co-1");
  });
});
