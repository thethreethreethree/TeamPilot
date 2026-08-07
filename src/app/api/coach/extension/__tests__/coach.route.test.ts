import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Endpoint wiring for the Sales Coach extension "coach my reply" route. Same security property as the
 * dissect route (shared guard): an unentitled or rate-limited request is turned away BEFORE the engine
 * runs. The engine (generateSalesReplyCoaching) never throws — honest-empty on failure — so no 502 branch.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ conversation: "a sales thread", draft: "here is my draft reply" })),
}));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Dana Rep" } }) }) }),
    }),
  })),
}));
vi.mock("@/lib/coach/extension/salesReplyCoach", () => ({ generateSalesReplyCoaching: vi.fn() }));

import { POST } from "@/app/api/coach/extension/coach/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { generateSalesReplyCoaching } from "@/lib/coach/extension/salesReplyCoach";

const entitled = {
  ok: true,
  user: { userId: "u", companyId: "c", entitlement: { status: "active", trialDaysLeft: 0, plan: "pro" } },
};
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/coach/extension/coach — gate ordering + pass-through", () => {
  it("pre-auth rate limit short-circuits before the gate and the engine", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow down" }, { status: 429 }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(requireEntitledExtensionUser).not.toHaveBeenCalled();
    expect(generateSalesReplyCoaching).not.toHaveBeenCalled();
  });

  it("unentitled tenant (402) is turned away BEFORE the engine runs", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(generateSalesReplyCoaching).not.toHaveBeenCalled();
  });

  it("entitled request returns the coaching + threads conversation, draft, and rep name", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateSalesReplyCoaching).mockResolvedValue({
      hasSignal: true,
      assessment: "leads with product",
      strengths: ["polite"],
      improvements: [{ point: "name the problem first", why: "SPIN" }],
      suggestedRevision: "What does the delay cost you weekly?",
      guidingQuestion: "what do they actually care about?",
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).coaching.hasSignal).toBe(true);
    expect(vi.mocked(generateSalesReplyCoaching).mock.calls[0]?.[0]).toMatchObject({
      conversation: "a sales thread",
      draft: "here is my draft reply",
      repName: "Dana Rep",
    });
  });

  it("honest-empty engine result still returns 200 with hasSignal:false", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(generateSalesReplyCoaching).mockResolvedValue({ hasSignal: false } as never);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).coaching.hasSignal).toBe(false);
  });
});
