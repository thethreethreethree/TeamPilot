import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/dissect?sessionId= readback — peer-rep IDOR gate (2026-08-15).
 *
 * The GET reads the stored dissect out of the company-wide `events` table, so it MUST first prove session
 * access via getSession (owner-or-manager RLS, migrations 0083/0084). These pin the 404 branch behaviourally:
 * the structural guard (sessionArtifactReadGate.test.ts) proves the getSession CALL exists; this proves it
 * actually blocks a peer and lets the owner/manager through. (POST is exercised elsewhere / via the shared
 * runAndStoreDissect unit tests; this file targets the readback gate specifically.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
}));

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

const getReq = (sessionId: string | null) =>
  ({ nextUrl: { searchParams: { get: () => sessionId } } }) as unknown as Parameters<typeof GET>[0];

const SID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    clientLabel: "Acme", context: "in_person", companyId: "co1", agentId: "rep1",
  });
});

describe("GET /dissect readback gate", () => {
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

  it("200 with the stored dissect for the owner/manager — getSession non-null", async () => {
    setAuth("rep1", { strengths: ["opened well"], growth_areas: [], overall: "solid" });
    const res = await GET(getReq(SID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dissect.hasSignal).toBe(true);
  });
});
