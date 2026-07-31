import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/skills[?agentId=] — the rep's own skill mirror, OR (with ?agentId) a
 * MANAGER reading a named rep's skill profile, which DELIBERATELY crosses the self-only A18 boundary.
 * That cross-person read is the security surface and was untested here. INV6 structurally guarantees the
 * route CALLS canManagerViewRepSkills; this locks the resulting BEHAVIOR: self-read needs no gate; a
 * non-manager is refused 403; a manager naming a cross-company / unknown rep gets 404 (never another
 * tenant's data); an authorized manager reads exactly the requested rep. isSalesCoachManager +
 * canManagerViewRepSkills are the REAL predicates; the read short-circuits on an empty history so the
 * LLM/aggregation pipeline isn't exercised — the gate is what's under test.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({
  getRecentAfterPitchSummariesAdmin: vi.fn(async () => []), // empty history → 200 {skills:[]} right after the gate
  getSessionTranscriptAdmin: vi.fn(async () => []),
}));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getRecentAfterPitchSummariesAdmin } from "@/lib/data/salesCoach";
import { GET } from "../route";

/** profiles read is keyed by the eq'd id: caller (auth.user.id) then target (requestedAgentId). */
const setup = (userId: string | null, profilesById: Record<string, unknown>) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({ maybeSingle: async () => ({ data: profilesById[id] ?? null }) }),
      }),
    }),
  });

const req = (agentId?: string) =>
  ({ url: `https://x/api/coach/sales-session/skills${agentId ? `?agentId=${agentId}` : ""}` }) as unknown as Parameters<typeof GET>[0];

const MANAGER = { role: "admin", sales_coach_role: null, company_id: "co1" };
const MEMBER = { role: "member", sales_coach_role: null, company_id: "co1" };
const recentMock = getRecentAfterPitchSummariesAdmin as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("GET /skills — ?agentId manager-access gate (A18)", () => {
  it("401 unauthenticated", async () => {
    setup(null, {});
    expect((await GET(req())).status).toBe(401);
  });

  it("self-read (no agentId) returns 200 and never consults the cross-person gate", async () => {
    setup("rep1", { rep1: MEMBER });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(recentMock).toHaveBeenCalledWith("rep1", expect.any(Number)); // read the caller's OWN sessions
  });

  it("403 when a NON-manager requests another rep's skills", async () => {
    setup("rep1", { rep1: MEMBER, rep2: MEMBER });
    const res = await GET(req("rep2"));
    expect(res.status).toBe(403);
    expect(recentMock).not.toHaveBeenCalled(); // refused before reading any data
  });

  it("404 when a manager names a cross-company / unknown rep (RLS returns null target)", async () => {
    setup("boss", { boss: MANAGER /* rep99 absent → target null (cross-company) */ });
    const res = await GET(req("rep99"));
    expect(res.status).toBe(404);
    expect(recentMock).not.toHaveBeenCalled(); // never reads another tenant's sessions
  });

  it("200 when an authorized manager reads a same-company rep — reads exactly that rep", async () => {
    setup("boss", { boss: MANAGER, rep2: { company_id: "co1" } });
    const res = await GET(req("rep2"));
    expect(res.status).toBe(200);
    expect(recentMock).toHaveBeenCalledWith("rep2", expect.any(Number)); // the REQUESTED rep, not the caller
  });
});
