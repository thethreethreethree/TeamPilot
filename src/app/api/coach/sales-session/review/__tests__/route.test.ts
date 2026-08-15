import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/review — generates the post-call growth review. Routine contract coverage
 * (session access is RLS-scoped via getSession, so tenant isolation is the RLS layer's job, guarded by
 * rls-audit). This pins the route's own contract: 401 unauth, 404 for an inaccessible session, and a 200 that
 * returns the generated review. generateSalesReview is mocked (the LLM is not exercised here).
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => [{ id: "s0", speaker: "agent", text: "hi", seq: 0 }]),
}));
vi.mock("@/lib/coach/v5/salesReview", () => ({
  generateSalesReview: vi.fn(async () => ({ hasSignal: true, strengths: [{ point: "opened well" }], growthAreas: [] })),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getSession } from "@/lib/data/salesCoach";
import { POST, GET } from "../route";

// A chainable events-query stub that terminates in maybeSingle → { data }.
const eventsChain = (payload: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: payload ? { payload } : null });
  return chain;
};

const setAuth = (userId: string | null, eventPayload: unknown = null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ insert: async () => ({ error: null }), ...eventsChain(eventPayload) }),
  });

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const getReq = (sessionId: string | null) =>
  ({ nextUrl: { searchParams: { get: () => sessionId } } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    clientLabel: "Acme", context: "in_person", companyId: "co1", agentId: "rep1",
  });
});

describe("POST /review", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req({ sessionId: "11111111-1111-4111-8111-111111111111" }))).status).toBe(401);
  });

  it("404 when the session isn't found/accessible (RLS-scoped read)", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req({ sessionId: "11111111-1111-4111-8111-111111111111" }))).status).toBe(404);
  });

  it("200 returns the generated review", async () => {
    setAuth("rep1");
    const res = await POST(req({ sessionId: "11111111-1111-4111-8111-111111111111" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.hasSignal).toBe(true);
  });
});

/**
 * GET /review readback — the peer-rep IDOR gate (2026-08-15). The GET reads the stored review out of the
 * company-wide `events` table, so it MUST first prove session access via getSession (owner-or-manager RLS).
 * These pin the 404 branch behaviourally — the structural guard (sessionArtifactReadGate.test.ts) proves the
 * getSession CALL exists; this proves it actually blocks a peer and lets the owner/manager through.
 */
describe("GET /review readback gate", () => {
  const SID = "11111111-1111-4111-8111-111111111111";

  it("400 when sessionId is missing", async () => {
    setAuth("rep1");
    expect((await GET(getReq(null))).status).toBe(400);
  });

  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await GET(getReq(SID))).status).toBe(401);
  });

  it("404 for a peer rep — getSession is null (the IDOR fix)", async () => {
    setAuth("peer2");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await GET(getReq(SID))).status).toBe(404);
  });

  it("200 with the stored review for the owner/manager — getSession non-null", async () => {
    setAuth("rep1", { strengths: [{ point: "opened well" }], growth_areas: [] });
    const res = await GET(getReq(SID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.hasSignal).toBe(true);
  });
});
