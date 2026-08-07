import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Endpoint wiring for the Sales Coach extension dissect route. Same security property as the C.A.R.E
 * extension routes (it reuses the SAME guard): an unentitled or rate-limited request is turned away BEFORE
 * the engine runs. The engine (generateSalesTextDissect) never throws — honest-empty on failure — so there
 * is no 502 branch by design. These lock the gate ordering + the pass-through of the engine result.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "a sales thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Dana Rep" } }) }) }),
    }),
  })),
}));
vi.mock("@/lib/coach/extension/salesTextDissect", () => ({ generateSalesTextDissect: vi.fn() }));

import { POST } from "@/app/api/coach/extension/dissect/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateSalesTextDissect } from "@/lib/coach/extension/salesTextDissect";

const entitled = {
  ok: true,
  user: { userId: "u", companyId: "c", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/coach/extension/dissect — gate ordering + pass-through", () => {
  it("pre-auth rate limit short-circuits before the gate and the engine", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow down" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateSalesTextDissect).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateSalesTextDissect).not.toHaveBeenCalled();
  });

  it("entitled request returns the engine's sales dissect, passing the rep name", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateSalesTextDissect).mockResolvedValue({
      hasSignal: true,
      summary: "prospect is warm but hesitant on price",
      strengths: [{ point: "opened with a discovery question", excerpt: "what's driving the timing?" }],
      opportunity: "name the objection instead of discounting",
      nextMove: "ask what number they had in mind",
      guidingQuestion: "what do you think the real hesitation is?",
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).dissect.hasSignal).toBe(true);
    expect(generateSalesTextDissect).toHaveBeenCalledOnce();
    // The rep name from the profile lookup is threaded into the engine call.
    expect(vi.mocked(generateSalesTextDissect).mock.calls[0]?.[0]).toMatchObject({ repName: "Dana Rep" });
  });

  it("honest-empty engine result still returns 200 with hasSignal:false", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateSalesTextDissect).mockResolvedValue({ hasSignal: false } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).dissect.hasSignal).toBe(false);
  });
});
