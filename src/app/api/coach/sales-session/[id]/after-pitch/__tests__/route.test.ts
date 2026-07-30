import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/[id]/after-pitch — the post-recording debrief read-back. Previously untested.
 * The load-bearing boundary is A18 PRIVACY: the rep (owner) sees the FULL summary including their private
 * scoreboard; a same-company MANAGER may read the coaching substance but the private `scores` are STRIPPED;
 * an outsider (not owner, not same-company manager) gets nothing. A regression that leaked a rep's private
 * self-scores to their manager would break the whole "mirror, not a scorecard" guarantee.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getLatestAfterPitchSummaryAdmin: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, getLatestAfterPitchSummaryAdmin } from "@/lib/data/salesCoach";
import { GET } from "../route";

const SESSION = { companyId: "co1", agentId: "rep1", context: "in_person", outcome: null };
const STORED = { hasSignal: true, scores: [{ key: "opener", display: "8/10" }], moments: [], narrative: {} };

/** Fake supabase: a caller identity + their profile row (role / company). */
const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = {} as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
  (getLatestAfterPitchSummaryAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(STORED);
});

describe("GET after-pitch — A18 privacy", () => {
  it("the OWNER (rep) sees the full summary, scores included", async () => {
    setCaller("rep1", { role: "member", company_id: "co1", sales_coach_role: null });
    const body = await (await GET(req, ctx)).json();
    expect(body.isOwner).toBe(true);
    expect(body.summary.scores).toEqual([{ key: "opener", display: "8/10" }]);
  });

  it("a same-company MANAGER sees the summary but with private scores STRIPPED", async () => {
    setCaller("boss1", { role: "admin", company_id: "co1", sales_coach_role: null });
    const body = await (await GET(req, ctx)).json();
    expect(body.isOwner).toBe(false);
    expect(body.summary.scores).toEqual([]); // stripped — never the rep's private numbers
    expect(body.summary.hasSignal).toBe(true); // coaching substance still present
  });

  it("an OUTSIDER (not owner, not same-company manager) gets nothing", async () => {
    setCaller("stranger", { role: "member", company_id: "coOTHER", sales_coach_role: null });
    const body = await (await GET(req, ctx)).json();
    expect(body).toEqual({ summary: null, isOwner: false });
  });

  it("an admin of a DIFFERENT company is NOT a manager here (tenant boundary)", async () => {
    setCaller("bossX", { role: "admin", company_id: "coOTHER", sales_coach_role: null });
    const body = await (await GET(req, ctx)).json();
    expect(body).toEqual({ summary: null, isOwner: false });
  });

  it("unauthenticated → null", async () => {
    setCaller(null, null);
    const body = await (await GET(req, ctx)).json();
    expect(body).toEqual({ summary: null, isOwner: false });
  });
});
