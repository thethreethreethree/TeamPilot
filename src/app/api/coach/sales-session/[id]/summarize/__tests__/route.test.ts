import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/[id]/summarize readback — peer-rep IDOR gate (2026-08-15).
 *
 * The GET reads the latest summary/moments/pivot/intel out of the company-wide `events` table, so it MUST
 * first prove session access via getSession (owner-or-manager RLS, 0083/0084). These pin the 404 branch
 * behaviourally: the structural guard proves the getSession CALL exists; this proves it blocks a peer and lets
 * the owner/manager through. The POST engines are mocked purely so importing the route is side-effect-free —
 * GET never calls them.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
}));
vi.mock("@/lib/coach/v5/salesSummary", () => ({ runAndStoreSummary: vi.fn() }));
vi.mock("@/lib/coach/v5/salesPivot", () => ({ runAndStorePivot: vi.fn() }));
vi.mock("@/lib/coach/v5/salesMoments", () => ({ runAndStoreMoments: vi.fn() }));
vi.mock("@/lib/coach/v5/salesIntel", () => ({ runAndStoreIntel: vi.fn() }));
vi.mock("@/lib/coach/v5/engineTimeout", () => ({ withEngineTimeout: (p: unknown) => p }));

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { GET } from "../route";

const eventsChain = (payload: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: payload ? { payload } : null });
  return chain;
};

const setAuth = (userId: string | null, eventPayload: unknown = null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => eventsChain(eventPayload),
  });

const SID = "11111111-1111-4111-8111-111111111111";
// GET(_req, { params: Promise<{id}> }) — _req is unused by the handler.
const call = () =>
  GET({} as unknown as Parameters<typeof GET>[0], {
    params: Promise.resolve({ id: SID }),
  } as unknown as Parameters<typeof GET>[1]);

beforeEach(() => {
  vi.clearAllMocks();
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    clientLabel: "Acme", context: "in_person", companyId: "co1", agentId: "rep1",
  });
});

describe("GET /[id]/summarize readback gate", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await call()).status).toBe(401);
  });

  it("404 for a peer rep — getSession is null (the IDOR fix)", async () => {
    setAuth("peer2");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  it("200 for the owner/manager — getSession non-null (summary read back)", async () => {
    setAuth("rep1", { summary: "They agreed to a follow-up." });
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBe("They agreed to a follow-up.");
  });
});
