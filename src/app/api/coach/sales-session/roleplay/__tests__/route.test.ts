import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/roleplay — turn-based text roleplay (an LLM plays the PROSPECT) + an
 * end-of-session review. Customer-facing LLM route, previously untested. Locks: input bounds (real zod
 * Body — an over-long conversation is rejected 400 before any LLM spend), 401 unauth, 403 pre-onboarding,
 * and — the property that matters most on an LLM route — the INJECTION POSTURE: the rep's own transcript
 * is passed as userMessage DATA, never interpolated into the systemPrompt. dissectCoachV5 is mocked and its
 * args captured; the zod Body + transcript assembly are the REAL code.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { dissectCoachV5 } from "@/lib/claude";
import { POST } from "../route";

const setCaller = (userId: string | null, companyId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: companyId ? { company_id: companyId } : null }) }) }) }),
  });

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const REP_LINE = "Hi, quick question about your rollout timeline?";
const validTurn = {
  phase: "turn",
  context: "in_person",
  persona: "Skeptical operations director",
  messages: [{ role: "rep", text: REP_LINE }],
};

beforeEach(() => {
  vi.clearAllMocks();
  (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ text: '{"reply":"Not interested right now."}' });
});

describe("POST /roleplay", () => {
  it("400 rejects an over-long conversation before any LLM spend (input bound)", async () => {
    // messages.max(80) — 81 turns is rejected by the real zod Body, and this happens BEFORE the LLM call.
    const tooLong = { ...validTurn, messages: Array.from({ length: 81 }, () => ({ role: "rep", text: "a" })) };
    expect((await POST(req(tooLong))).status).toBe(400);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("401 for an unauthenticated caller (valid body)", async () => {
    setCaller(null, null);
    expect((await POST(req(validTurn))).status).toBe(401);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("403 before onboarding (authenticated, no company)", async () => {
    setCaller("rep1", null);
    expect((await POST(req(validTurn))).status).toBe(403);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("200 on a valid turn — and the rep's transcript is DATA (userMessage), never in the systemPrompt", async () => {
    setCaller("rep1", "co1");
    const res = await POST(req(validTurn));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Not interested right now." });
    // The LLM was called with the company scope from AUTH, the rep's line inside userMessage, and NOT in the
    // system prompt — the injection-posture guarantee for an LLM route fed rep-controlled text.
    const arg = (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      companyId: string;
      systemPrompt: string;
      userMessage: string;
    };
    expect(arg.companyId).toBe("co1");
    expect(arg.userMessage).toContain(REP_LINE);
    expect(arg.systemPrompt).not.toContain(REP_LINE);
  });
});
