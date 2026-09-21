import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST/GET /api/coach/sales-session/pitch-score.
 *
 * The four assertions that matter here are not about status codes. They are about what gets
 * WRITTEN, because each of the four has the same failure mode: the write succeeds, nothing errors,
 * and a real number lands against the wrong person, the wrong week, or the wrong kind of
 * conversation.
 *
 *   1. rep_id is the SESSION'S rep, never the caller — or every manager-triggered score lands on
 *      the manager's leaderboard and the rep's stays empty.
 *   2. recorded_at is the RECORDING's time, never now() — the "recorded on the 4th, filed as the
 *      11th" bug this product has already shipped.
 *   3. A huddle is not scored against a door-to-door pitch rubric.
 *   4. An outcome the column cannot hold ('no_contact') is mapped, not forwarded — forwarding it
 *      fails the CHECK and loses the whole write AFTER the LLM has been paid for.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/api/callerCompanyId", () => ({ callerCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => [{ speaker: "agent", text: "Hey" }]),
}));
vi.mock("@/lib/coach/pitchScore/generatePitchScore", () => ({ generatePitchScore: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/storePitchScore", () => ({ storePitchScore: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/readPitchScore", () => ({ readPitchScore: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { generatePitchScore } from "@/lib/coach/pitchScore/generatePitchScore";
import { storePitchScore } from "@/lib/coach/pitchScore/storePitchScore";
import { readPitchScore } from "@/lib/coach/pitchScore/readPitchScore";
import { rateLimit } from "@/lib/api/rateLimit";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const SID = "11111111-1111-4111-8111-111111111111";

const RECORDED_AT = "2026-09-04T18:00:00.000Z";

const SESSION = {
  id: SID,
  companyId: "co1",
  agentId: "rep-who-gave-the-pitch",
  sessionKind: "sales",
  clientLabel: "Maple Ct",
  startedAt: RECORDED_AT,
  endedAt: "2026-09-04T18:07:30.000Z",
  audioDurationSeconds: 412,
  audioAssetUrl: "https://example.test/a.mp3",
  outcome: "sold",
};

const SCORE = {
  ok: true as const,
  score: { total: 80.3, base: 62.4, bonus: 20, violations: 2, rubricVersion: "attfiber-v1" },
  elements: [],
  bonuses: [],
  violations: [],
  timestampsUnavailable: false,
};

const setAuth = (userId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

const postReq = (body: unknown = { sessionId: SID }) =>
  ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

const getReq = (sessionId: string | null) =>
  ({ nextUrl: { searchParams: { get: () => sessionId } } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  asMock(rateLimit).mockReturnValue(null);
  setAuth("a-manager");
  asMock(getSession).mockResolvedValue({ ...SESSION });
  asMock(generatePitchScore).mockResolvedValue(SCORE);
  asMock(storePitchScore).mockResolvedValue("pitch-1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const storedArgs = () => asMock(storePitchScore).mock.calls[0]![0] as Record<string, unknown>;

describe("what gets written", () => {
  it("files the score against the SESSION'S rep, not the manager who triggered it", async () => {
    setAuth("a-manager");
    const res = await POST(postReq());
    expect(res.status).toBe(200);
    expect(storedArgs().repId).toBe("rep-who-gave-the-pitch");
    expect(storedArgs().repId).not.toBe("a-manager");
  });

  it("uses the recording's own time, not now()", async () => {
    await POST(postReq());
    expect(storedArgs().recordedAt).toBe(RECORDED_AT);
    // An upload processed days later would otherwise land in the wrong week on the leaderboard.
    expect(new Date(storedArgs().recordedAt as string).getUTCDate()).toBe(4);
  });

  it("prefers the real audio length over the started..ended wall-clock", async () => {
    // For an upload, wall-clock is when the FILE was processed — 450s here vs 412s of real audio.
    await POST(postReq());
    expect(storedArgs().durationS).toBe(412);
  });

  it("falls back to wall-clock when there is no measured audio length", async () => {
    asMock(getSession).mockResolvedValue({ ...SESSION, audioDurationSeconds: null });
    await POST(postReq());
    expect(storedArgs().durationS).toBe(450);
  });

  it("stores no duration at all for a session that never ended", async () => {
    asMock(getSession).mockResolvedValue({
      ...SESSION,
      audioDurationSeconds: null,
      endedAt: null,
    });
    await POST(postReq());
    expect(storedArgs().durationS).toBeNull();
  });
});

describe("the outcome vocabularies differ", () => {
  it.each(["sold", "follow_up", "no_sale"])("passes %s through", async (outcome) => {
    asMock(getSession).mockResolvedValue({ ...SESSION, outcome });
    await POST(postReq());
    expect(storedArgs().outcome).toBe(outcome);
  });

  it.each(["no_contact", "undecided", null])("maps %s to null", async (outcome) => {
    // pitches.outcome allows three values. Forwarding a fourth violates the CHECK and loses the
    // whole write AFTER the LLM call was paid for. And a door nobody answered is not a "no_sale" —
    // recording it as one would make the sold-rate, a hard metric, a lie.
    asMock(getSession).mockResolvedValue({ ...SESSION, outcome });
    await POST(postReq());
    expect(storedArgs().outcome).toBeNull();
  });
});

describe("what is not scored", () => {
  it.each(["huddle", "meeting"])("refuses a %s with a reason, and never calls the LLM", async (kind) => {
    asMock(getSession).mockResolvedValue({ ...SESSION, sessionKind: kind });
    const res = await POST(postReq());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain(kind);
    // Refused BEFORE the spend — scoring then discarding is the empty-but-billed shape.
    expect(generatePitchScore).not.toHaveBeenCalled();
    expect(storePitchScore).not.toHaveBeenCalled();
  });

  it("scores a sales session", async () => {
    expect((await POST(postReq())).status).toBe(200);
    expect(generatePitchScore).toHaveBeenCalled();
  });
});

describe("no failure is ever stored as a score", () => {
  it.each([
    ["no_agent_turns", 422],
    ["suppressed", 502],
    ["llm_empty", 502],
    ["parse_failed", 502],
  ])("%s → %i, and nothing is written", async (failure, status) => {
    asMock(generatePitchScore).mockResolvedValue({ ok: false, failure });
    const res = await POST(postReq());
    expect(res.status).toBe(status);
    expect(storePitchScore).not.toHaveBeenCalled();
    // A reason the caller can act on, not a bare failure code.
    expect((await res.json()).error).toBeTruthy();
  });

  it("500s when the write fails, and does not report a pitch id", async () => {
    asMock(storePitchScore).mockResolvedValue(null);
    const res = await POST(postReq());
    expect(res.status).toBe(500);
    expect((await res.json()).pitchId).toBeUndefined();
  });

  it("does not leak the database's message on a write failure", async () => {
    asMock(storePitchScore).mockResolvedValue(null);
    const body = await (await POST(postReq())).json();
    expect(JSON.stringify(body)).not.toMatch(/constraint|column|relation/i);
  });
});

describe("access", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(postReq())).status).toBe(401);
  });

  it("404 for a peer rep — getSession is null (the IDOR gate)", async () => {
    asMock(getSession).mockResolvedValue(null);
    const res = await POST(postReq());
    expect(res.status).toBe(404);
    expect(generatePitchScore).not.toHaveBeenCalled();
  });

  it("honours the rate limiter before doing anything", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    expect((await POST(postReq())).status).toBe(429);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("rejects a body without a uuid sessionId", async () => {
    const res = await POST(postReq({ sessionId: "not-a-uuid" }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(generatePitchScore).not.toHaveBeenCalled();
  });
});

describe("GET readback", () => {
  it("400 without a sessionId", async () => {
    expect((await GET(getReq(null))).status).toBe(400);
  });

  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await GET(getReq(SID))).status).toBe(401);
  });

  it("404 for a peer rep, before the pitch is read", async () => {
    asMock(getSession).mockResolvedValue(null);
    expect((await GET(getReq(SID))).status).toBe(404);
    expect(readPitchScore).not.toHaveBeenCalled();
  });

  it("returns null rather than 404 for a session that exists but was never scored", async () => {
    // Distinct states. 404 means "you may not see this"; null means "nothing has scored it yet",
    // and the UI offers a Score button for the second and nothing for the first.
    asMock(readPitchScore).mockResolvedValue(null);
    const res = await GET(getReq(SID));
    expect(res.status).toBe(200);
    expect((await res.json()).pitch).toBeNull();
  });

  it("returns the stored pitch for the owner or a manager", async () => {
    asMock(readPitchScore).mockResolvedValue({ id: "p1", total: 80.3 });
    const body = await (await GET(getReq(SID))).json();
    expect(body.pitch).toMatchObject({ id: "p1", total: 80.3 });
  });

  it("reads through the CALLER's client, not an anonymous one", async () => {
    // Scoped for identity, anonymous for the read is the shape that has cost five defects here:
    // a phone caller would get an honest-looking "not scored yet" for a pitch that exists.
    asMock(readPitchScore).mockResolvedValue(null);
    await GET(getReq(SID));
    expect(asMock(readPitchScore).mock.calls[0]![1]).toBeTruthy();
  });
});
