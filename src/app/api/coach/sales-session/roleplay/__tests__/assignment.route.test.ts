import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /roleplay review with an assignmentId (RSS Phase 7). Pins: an assignment that is not the caller's is a 404
 * with no LLM spend; an assigned review is scored against the SCENARIO's skill (not a client-sent focus) and returns
 * the pass result against the scenario's mark.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/coach/v5/practiceAnalytics", () => ({ recordPracticeScore: vi.fn() }));
vi.mock("@/lib/coach/gamification/notify", () => ({ notifyTrainingAttempted: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("@/lib/coach/remote/training", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/training")>()),
  assignmentForRep: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { dissectCoachV5 } from "@/lib/claude";
import { assignmentForRep } from "@/lib/coach/remote/training";
import { POST } from "../route";

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const review = {
  phase: "review",
  context: "phone",
  persona: "Busy owner",
  focus: "something the client chose",
  assignmentId: "0b6f7c1e-1111-4222-8333-944455556666",
  messages: [{ role: "rep", text: "Can I ask what matters most to you?" }, { role: "prospect", text: "Price." }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "rep1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) }),
  });
});

describe("assigned practice review", () => {
  it("404 when the assignment is not the caller's — no LLM call", async () => {
    mock(assignmentForRep).mockResolvedValue(null);
    expect((await POST(req(review))).status).toBe(404);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("scores the scenario's skill and returns the pass result", async () => {
    mock(assignmentForRep).mockResolvedValue({
      id: "a1",
      assignedBy: "mgr1",
      scenario: { title: "Price pushback", focus: "Handle a price objection with value", pass_score: 70 },
    });
    mock(dissectCoachV5).mockResolvedValue({
      text: JSON.stringify({ summary: "Good.", whatWorked: ["asked"], toImprove: [], correctLine: null, applied: true, score: 75, nextRep: "Again." }),
    });
    const res = await POST(req(review));
    const body = await res.json();
    expect(res.status).toBe(200);
    const sent = mock(dissectCoachV5).mock.calls[0]![0] as { systemPrompt: string; userMessage: string };
    expect(sent.systemPrompt).toContain("Handle a price objection with value");
    expect(sent.systemPrompt).not.toContain("something the client chose");
    expect(sent.systemPrompt).toContain("a phone call");
    expect(body.attempt).toEqual({ passed: true, passScore: 70 });
  });
});
