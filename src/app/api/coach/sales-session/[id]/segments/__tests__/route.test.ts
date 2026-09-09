import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/segments — owner-check regression guard (INV19 / 0082 A18 class).
 *
 * appendTranscriptSegment writes via the service-role client (bypasses RLS) and getSession is
 * company-scoped, so the route must assert the caller is the session's own rep — else a same-company
 * colleague could inject transcript into another rep's session. Pins: non-owner → 403 and no append.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(async () => ({ segments: [{ speaker: "agent", text: "hello", seq: 0 }] })),
}));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  appendTranscriptSegment: vi.fn(async () => ({ id: "seg1" })),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const setUser = (userId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => ({}) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/sales-session/[id]/segments — owner check (INV19)", () => {
  it("403 when the caller is NOT the session's rep — no transcript is appended", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "another-rep", context: "in_person" });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(403);
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
  });

  it("the session's own rep passes the owner check (not 403'd)", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "me", context: "in_person" });
    expect((await POST(req(), ctx("s1"))).status).not.toBe(403);
  });

  it("404 when the session does not exist (before the owner check)", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(req(), ctx("nope"))).status).toBe(404);
  });
});

describe("GET /api/coach/sales-session/[id]/segments — RLS-gated transcript read (9/2 admin access)", () => {
  // A chainable client whose transcript read resolves to `rows`; RLS is what actually gates it in prod (the read
  // returns zero rows for an unauthorized session), so the route just returns what the caller's client can see.
  const setGet = (userId: string | null, rows: unknown[]) =>
    asMock(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
      from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }),
    });
  const getReq = () => ({}) as unknown as Parameters<typeof GET>[0];

  it("401 when unauthenticated", async () => {
    setGet(null, []);
    expect((await GET(getReq(), ctx("s1"))).status).toBe(401);
  });

  it("returns the session's transcript segments (what the caller's RLS-scoped read sees)", async () => {
    setGet("admin", [
      { speaker: "agent", text: "Hi there", seq: 0, spoken_at: null },
      { speaker: "customer", text: "Not interested", seq: 1, spoken_at: null },
    ]);
    const res = await GET(getReq(), ctx("s1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.segments).toHaveLength(2);
    expect(body.segments[0]).toMatchObject({ speaker: "agent", text: "Hi there" });
  });

  it("an unauthorized session reads as an honest EMPTY (RLS returns no rows), never a peer's transcript", async () => {
    setGet("peer-rep", []);
    const body = await (await GET(getReq(), ctx("someone-elses"))).json();
    expect(body.segments).toEqual([]);
  });
});
