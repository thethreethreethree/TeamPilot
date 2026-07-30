import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/elo — the Agent Sales Effectivity Rating. Previously untested.
 * Three access boundaries pinned (owner-privacy rules): (1) a rep may read only their OWN rating — a peer's is 403;
 * (2) a manager may read a SAME-company rep but a cross-company target is 404; (3) exposure discipline — the
 * OWNER gets their full per-session history, a MANAGER gets the rating only (history stripped to []). A
 * regression on (3) would leak a rep's finer per-call self-assessment curve to their manager. rateLimit is
 * mocked out; isSalesCoachManager + canManagerViewRepSkills are the real predicates.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/coach/v5/salesElo", () => ({ getAgentEloRating: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentEloRating } from "@/lib/coach/v5/salesElo";
import { GET } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

/** The admin target-profile lookup (for the manager-views-another-rep path). */
const setTarget = (companyId: string | null) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: companyId ? { company_id: companyId } : null }) }) }) }),
  });

const req = (agentId: string | null) =>
  ({ nextUrl: { searchParams: { get: () => agentId } } }) as unknown as Parameters<typeof GET>[0];

const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  (getAgentEloRating as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    rating: 1240,
    gamesPlayed: 8,
    provisional: false,
    history: [{ delta: 5 }, { delta: -3 }, { delta: 7 }],
  });
});

describe("GET /elo — access + exposure", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET(req(null))).status).toBe(401);
  });

  it("a rep reading their OWN rating gets it, WITH full history (own data)", async () => {
    setCaller("rep1", REP);
    const res = await GET(req("rep1")); // agentId === self
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.elo.rating).toBe(1240);
    expect(body.elo.history).toHaveLength(3);
  });

  it("a rep reading a PEER's rating is refused (403)", async () => {
    setCaller("rep1", REP);
    expect((await GET(req("rep2"))).status).toBe(403); // not self, not a manager
    expect(createAdminClient).not.toHaveBeenCalled(); // never even looks the peer up
  });

  it("a manager reads a SAME-company rep — rating only, history STRIPPED (privacy)", async () => {
    setCaller("boss", MANAGER);
    setTarget("co1"); // target rep is in the manager's company
    const res = await GET(req("rep2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.elo.rating).toBe(1240);
    expect(body.elo.history).toEqual([]); // manager never sees the per-session breakdown
    expect(body.elo.lastDelta).toBe(7); // but does get the latest trend delta
  });

  it("a manager reading a DIFFERENT-company rep is 404 (tenant boundary)", async () => {
    setCaller("boss", MANAGER);
    setTarget("coOTHER");
    expect((await GET(req("repX"))).status).toBe(404);
  });
});
