import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/practice-scenario/from-pitch — reconstruct a roleplay from a REAL recorded pitch.
 * Locks the security + honesty seams of an LLM route fed a stored transcript: 400 on a non-uuid pitchId (before
 * any LLM spend), 401 unauth, 403 pre-onboarding, 404 when the pitch is not accessible (RLS — no cross-rep
 * transcript leak), an HONEST {scenario:null} with NO LLM call when there is no transcript to rebuild from, and the
 * happy path returning the parsed scenario + the pitch's top improvement as the scored `focus`. dissectCoachV5 is
 * mocked and its call presence asserted; the zod Body + the read/branch logic are the REAL code.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { dissectCoachV5 } from "@/lib/claude";
import { POST } from "../route";

const PID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // valid uuid v4 (version 4, variant 8)

function setup(opts: {
  user?: string | null;
  company?: string | null;
  pitch?: unknown;
  transcript?: unknown;
  analysis?: unknown;
}) {
  const { user = "rep1", company = "co1", pitch, transcript = null, analysis = null } = opts;
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from: (t: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (t === "profiles") return { data: company ? { company_id: company } : null };
            if (t === "pitches") return { data: pitch ?? null };
            if (t === "pitch_transcripts") return { data: transcript };
            if (t === "pitch_analyses") return { data: analysis };
            return { data: null };
          },
        }),
      }),
    }),
  });
}

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const ACCESSIBLE_PITCH = { id: PID, door_knocks: { outcome: "not_interested" } };

beforeEach(() => {
  vi.clearAllMocks();
  (dissectCoachV5 as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    text: '{"title":"The skeptical homeowner","persona":"Guarded homeowner","situation":"Pushed back hard on price."}',
  });
});

describe("POST /practice-scenario/from-pitch", () => {
  it("400 on a non-uuid pitchId, before any LLM spend", async () => {
    const res = await POST(req({ pitchId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("401 for an unauthenticated caller", async () => {
    setup({ user: null });
    expect((await POST(req({ pitchId: PID }))).status).toBe(401);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("403 before onboarding (authenticated, no company)", async () => {
    setup({ user: "rep1", company: null });
    expect((await POST(req({ pitchId: PID }))).status).toBe(403);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("404 when the pitch is not accessible (RLS) — no cross-rep transcript leak, no LLM call", async () => {
    setup({ pitch: null });
    expect((await POST(req({ pitchId: PID }))).status).toBe(404);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("honest {scenario:null,focus:null} with NO LLM call when the pitch has no transcript", async () => {
    setup({ pitch: ACCESSIBLE_PITCH, transcript: null });
    const res = await POST(req({ pitchId: PID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scenario: null, focus: null });
    expect(dissectCoachV5).not.toHaveBeenCalled(); // no transcript → don't burn an LLM call
  });

  it("happy path: reconstructs the scenario + returns the pitch's top improvement as the scored focus", async () => {
    setup({
      pitch: ACCESSIBLE_PITCH,
      transcript: { text: "REP: solar? CUSTOMER: too expensive." },
      analysis: { improvements: ["Handle the price objection with a value reframe", "Ask more discovery"] },
    });
    const res = await POST(req({ pitchId: PID }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scenario: { persona: string } | null; focus: string | null };
    expect(body.scenario?.persona).toBe("Guarded homeowner");
    expect(body.focus).toBe("Handle the price objection with a value reframe"); // improvements[0] = the weak spot
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });

  it("focus is null when there is a transcript but no analysis improvements (still reconstructs, unscored)", async () => {
    setup({ pitch: ACCESSIBLE_PITCH, transcript: { text: "REP: hi. CUSTOMER: no thanks." }, analysis: null });
    const res = await POST(req({ pitchId: PID }));
    const body = (await res.json()) as { scenario: unknown; focus: string | null };
    expect(body.focus).toBeNull();
    expect(body.scenario).not.toBeNull(); // still reconstructs from the transcript
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
  });
});
