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
import { POST } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  });

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

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
