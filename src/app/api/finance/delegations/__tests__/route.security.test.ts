import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/finance/delegations — the "absence IS the security model" invariant.
 *
 * A delegation row GRANTS approval authority. If the route accepted a delegatorId,
 * a member could POST { delegatorId: "<the CFO>", delegateId: "<self>" } and mint a
 * delegation FROM someone else TO themselves — becoming a CFO with an audit trail
 * that endorses it. The route defends this two ways, both pinned here:
 *   1. the schema is .strict() — a delegatorId (or any extra key) is REJECTED (400);
 *   2. the RPC call carries NO delegator argument — the delegator is derived from
 *      auth.uid() server-side, never from the request.
 *
 * A future change that adds delegatorId to the schema or the RPC call breaks these.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

function fakeSb(userId: string | null) {
  const rpc = vi.fn(async () => ({ data: "new-id", error: null }));
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    rpc,
    _rpc: rpc,
  };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
beforeEach(() => vi.mocked(createClient).mockReset());

describe("delegation POST — no delegator field accepted", () => {
  it("REJECTS a forged delegatorId via the strict schema (400) and never calls the RPC", async () => {
    const sb = fakeSb("member");
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(
      req({
        action: "delegate",
        delegatorId: "the-cfo", // the forgery — must be rejected
        delegateId: "11111111-1111-4111-8111-111111111111",
        startsOn: "2026-07-16",
        endsOn: "2026-07-30",
      })
    );
    expect(res.status).toBe(400);
    expect(sb._rpc).not.toHaveBeenCalled();
  });

  it("passes NO delegator argument to the RPC on a valid delegate (delegator = auth.uid() server-side)", async () => {
    const sb = fakeSb("member");
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(
      req({
        action: "delegate",
        delegateId: "22222222-2222-4222-8222-222222222222",
        startsOn: "2026-07-16",
        endsOn: "2026-07-30",
        reason: "leave",
      })
    );
    expect(res.status).toBe(200);
    expect(sb._rpc).toHaveBeenCalledOnce();
    const [fn, args] = sb._rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(fn).toBe("fin_delegate_approval");
    // The whole point: not one of these keys carries a delegator.
    expect(Object.keys(args).sort()).toEqual(["p_delegate_id", "p_ends", "p_reason", "p_starts"]);
    expect(JSON.stringify(args).toLowerCase()).not.toContain("delegator");
  });

  it("401s an anonymous caller", async () => {
    vi.mocked(createClient).mockResolvedValue(fakeSb(null) as never);
    const res = await POST(req({ action: "delegate", delegateId: "x", startsOn: "2026-07-16", endsOn: "2026-07-30" }));
    expect(res.status).toBe(401);
  });
});
