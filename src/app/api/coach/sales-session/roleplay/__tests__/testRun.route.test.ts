import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gong F17.4 (2026-11-22): a manager tries a scenario before assigning it. The test run is scored so they can see it,
 * but it must not enter their own practice history — "Test run — not recorded" is a promise on the screen.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/coach/v5/practiceAnalytics", () => ({ recordPracticeScore: vi.fn() }));
vi.mock("@/lib/coach/gamification/notify", () => ({ notifyTrainingAttempted: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
// after() runs its callback straight away here, so recording is observable.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { createClient } from "@/lib/supabase/server";
import { dissectCoachV5 } from "@/lib/claude";
import { recordPracticeScore } from "@/lib/coach/v5/practiceAnalytics";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { POST } from "../route";

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const review = (extra: Record<string, unknown> = {}) => ({
  phase: "review",
  context: "phone",
  persona: "Busy owner",
  focus: "Handle a price objection with value",
  messages: [{ role: "rep", text: "Can I ask what matters most to you?" }, { role: "prospect", text: "Price." }],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "mgr1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) }),
  });
  mock(dissectCoachV5).mockResolvedValue({
    text: JSON.stringify({ summary: "Good.", whatWorked: ["asked"], toImprove: [], correctLine: null, applied: true, score: 75, nextRep: "Again." }),
  });
});

describe("practice review recording", () => {
  it("an ordinary practice is recorded in the person's history", async () => {
    expect((await POST(req(review()))).status).toBe(200);
    expect(recordPracticeScore).toHaveBeenCalledTimes(1);
  });

  it("a manager's test run is scored but recorded nowhere", async () => {
    mock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr1", companyId: "co1" });
    const res = await POST(req(review({ testRun: true })));
    expect(res.status).toBe(200);
    expect((await res.json()).scorecard ?? true).toBeTruthy();
    expect(recordPracticeScore).not.toHaveBeenCalled();
  });

  it("a REP sending testRun is still recorded — the flag can't hide a weak score (independent review)", async () => {
    mock(requireSalesCoachManager).mockResolvedValue(null);
    expect((await POST(req(review({ testRun: true })))).status).toBe(200);
    expect(recordPracticeScore).toHaveBeenCalledTimes(1);
  });
});
