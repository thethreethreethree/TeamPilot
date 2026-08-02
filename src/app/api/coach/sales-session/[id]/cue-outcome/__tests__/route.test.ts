import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/cue-outcome — owner-check regression guard (INV19 / 0082 A18 class).
 *
 * appendCueOutcome writes via the service-role client (bypasses RLS) and getSession is company-scoped, so
 * the route must assert the caller is the session's own rep — else a same-company colleague could mark cue
 * outcomes on another rep's session, bending the §3.5 reliance signal. Pins: non-owner → 403 and no append.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ cueId: "cue1", outcome: "used" })) }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionCuesAdmin: vi.fn(async () => [{ id: "cue1" }]),
  appendCueOutcome: vi.fn(async () => ({ id: "out1" })),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendCueOutcome } from "@/lib/data/salesCoach";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const setUser = (userId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => ({}) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/sales-session/[id]/cue-outcome — owner check (INV19)", () => {
  it("403 when the caller is NOT the session's rep — no outcome is appended", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "another-rep", context: "in_person" });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(403);
    expect(appendCueOutcome).not.toHaveBeenCalled();
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
