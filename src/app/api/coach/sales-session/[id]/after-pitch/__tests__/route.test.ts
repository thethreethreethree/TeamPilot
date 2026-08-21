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
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/experience/mode", () => ({ getExperienceMode: vi.fn(async () => undefined) }));
vi.mock("@/lib/coach/v5/generateAndStoreAfterPitch", () => ({ generateAndStoreAfterPitch: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getSession, getLatestAfterPitchSummaryAdmin } from "@/lib/data/salesCoach";
import { generateAndStoreAfterPitch } from "@/lib/coach/v5/generateAndStoreAfterPitch";
import { GET, POST } from "../route";

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
  // POST generates on demand via the shared helper (P1 refactor); return a signal-bearing summary.
  (generateAndStoreAfterPitch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ generated: true, summary: STORED });
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

// POST generates the summary on demand via the shared generateAndStoreAfterPitch (P1 refactor). The SAME A18
// privacy stripping must apply to a freshly-generated summary as to a stored one — the refactor must not have
// let a rep's private scores through to a manager on the generate path.
const postReq = { method: "POST" } as unknown as Parameters<typeof POST>[0];
describe("POST after-pitch — generates via the shared helper + keeps A18 privacy", () => {
  it("the OWNER (rep) generates and sees the full summary, scores included", async () => {
    setCaller("rep1", { role: "member", company_id: "co1", sales_coach_role: null });
    const body = await (await POST(postReq, ctx)).json();
    expect(generateAndStoreAfterPitch).toHaveBeenCalledTimes(1);
    expect(body.isOwner).toBe(true);
    expect(body.summary.scores).toEqual([{ key: "opener", display: "8/10" }]);
  });

  it("a same-company MANAGER triggers generation but the private scores are STRIPPED from the result", async () => {
    setCaller("boss1", { role: "admin", company_id: "co1", sales_coach_role: null });
    const body = await (await POST(postReq, ctx)).json();
    expect(generateAndStoreAfterPitch).toHaveBeenCalledTimes(1);
    expect(body.isOwner).toBe(false);
    expect(body.summary.scores).toEqual([]); // stripped on the generate path too
    expect(body.summary.hasSignal).toBe(true);
  });

  it("an outsider gets nothing and generation is NOT triggered", async () => {
    setCaller("stranger", { role: "member", company_id: "coOTHER", sales_coach_role: null });
    const res = await POST(postReq, ctx);
    expect(res.status).toBe(403);
    expect(generateAndStoreAfterPitch).not.toHaveBeenCalled();
  });
});
