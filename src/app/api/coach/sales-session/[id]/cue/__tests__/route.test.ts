import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/cue — owner-check regression guard (INV19 / the 0082 A18 class).
 *
 * appendCue writes to coaching_cues via the SERVICE-ROLE client (bypasses RLS), and getSession is
 * COMPANY-scoped (owner OR any same-company manager, per 0084). So the route MUST additionally assert the
 * caller is the session's own rep — otherwise a same-company colleague could POST to another rep's session
 * and inject cue rows, inflating that rep's §3.5 cue-reliance count. This pins that check: a non-owner
 * same-company caller gets 403 and appendCue is never reached; the owner is not 403'd.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ mode: "suggestion" })) }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
  appendCue: vi.fn(async () => ({ id: "cue1" })),
  getAgentCoachStart: vi.fn(async () => null),
}));
vi.mock("@/lib/coach/v5/liveCue", () => ({ generateLiveCue: vi.fn(async () => ({ shouldCue: false, mode: "suggestion", cue: "" })) }));
vi.mock("@/lib/experience/mode", () => ({ getExperienceMode: vi.fn(async () => "expert") }));
vi.mock("@/lib/coach/v5/observeWindow", () => ({
  isWithinObserveWindow: vi.fn(() => false),
  observeWindowEndsAt: vi.fn(() => null),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendCue } from "@/lib/data/salesCoach";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const setUser = (userId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => ({}) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/sales-session/[id]/cue — owner check (INV19)", () => {
  it("403 when the caller is NOT the session's rep — no cue is injected", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "another-rep", context: "in_person" });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).toBe(403);
    expect(appendCue).not.toHaveBeenCalled();
  });

  it("the session's own rep passes the owner check (not 403'd)", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "me", context: "in_person" });
    const res = await POST(req(), ctx("s1"));
    expect(res.status).not.toBe(403);
  });

  it("404 when the session does not exist (before the owner check)", async () => {
    setUser("me");
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(req(), ctx("nope"))).status).toBe(404);
  });
});
