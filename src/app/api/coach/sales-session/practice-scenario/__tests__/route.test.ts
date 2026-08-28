import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/practice-scenario — generate ONE practice scenario for a rep's focus skill.
 * Previously untested (its from-pitch sibling is covered; this locks the same seams for the Training-tab
 * generator): 400 on an empty/over-long focus (before any LLM spend), 401 unauth, 403 pre-onboarding, and the
 * HONEST fallback — a malformed generation returns {scenario:null} (200), never a fabricated scenario, so the
 * client falls back to the plain focus seed (the honesty-thesis rule — never a fabricated scenario). dissectCoachV5
 * is mocked; the zod Body + parse are the REAL code.
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
const VALID = { focus: "Handle the price objection with a value reframe" };

beforeEach(() => {
  vi.clearAllMocks();
  (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    text: '{"title":"The burned homeowner","persona":"Guarded homeowner","situation":"Bad experience with a competitor; short on time."}',
  });
});

describe("POST /practice-scenario", () => {
  it("400 on an empty focus, before any LLM spend", async () => {
    const res = await POST(req({ focus: "" }));
    expect(res.status).toBe(400);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("400 on an over-long focus (>600 chars), before any LLM spend", async () => {
    const res = await POST(req({ focus: "a".repeat(601) }));
    expect(res.status).toBe(400);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("401 for an unauthenticated caller", async () => {
    setCaller(null, null);
    expect((await POST(req(VALID))).status).toBe(401);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("403 before onboarding (authenticated, no company)", async () => {
    setCaller("rep1", null);
    expect((await POST(req(VALID))).status).toBe(403);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("200 with a parsed scenario on the happy path", async () => {
    setCaller("rep1", "co1");
    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scenario: { persona: string } | null };
    expect(body.scenario?.persona).toBe("Guarded homeowner");
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });

  it("honest {scenario:null} (200) on a malformed generation — client falls back to the plain seed", async () => {
    setCaller("rep1", "co1");
    (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ text: "not json at all" });
    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scenario: null });
  });
});
