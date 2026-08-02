import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/segments — owner-check regression guard (INV19 / 0082 A18 class).
 *
 * appendTranscriptSegment writes via the service-role client (bypasses RLS) and getSession is
 * company-scoped, so the route must assert the caller is the session's own rep — else a same-company
 * colleague could inject transcript into another rep's session. Pins: non-owner → 403 and no append.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
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
import { POST } from "../route";

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
