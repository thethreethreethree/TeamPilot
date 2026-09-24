import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `scoreSession` — the single authority for "was this recording scored, and if not, why".
 *
 * WHAT THIS FILE PINS, and why it did not exist until the day it was needed.
 *
 * Every refusal this function returns is a decision it MADE: a huddle, no rep speech, guidance
 * off. It had no top-level try/catch, so everything it did NOT decide — a provider error, a rate
 * limit, a malformed transcript, a Postgres blip — left as an exception instead of a verdict.
 *
 * On 2026-09-24 a manager pressed "Score them all" against 194 real recordings. The drain calls
 * this in a bare loop, so the first recording that threw propagated out of the loop, out of the
 * POST as a 500, and the only thing on screen was "Scoring stopped because the request failed".
 * Nothing was scored. The cause had to be found by reading code, because the screen could not say
 * it.
 *
 * A caller that must wrap this in its own try/catch is a caller re-deriving a decision this
 * function owns (§2.2). So the contract under test is blunt: IT RETURNS AN OUTCOME. It does not
 * throw. Not for a read, not for the LLM, not for the write.
 */

vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(),
}));
vi.mock("../generatePitchScore", () => ({ generatePitchScore: vi.fn() }));
vi.mock("../storePitchScore", () => ({ storePitchScore: vi.fn() }));
vi.mock("@/lib/coach/patterns/runDetection", () => ({ runDetection: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generatePitchScore } from "../generatePitchScore";
import { storePitchScore } from "../storePitchScore";
import { scoreSession, PERMANENT_REFUSALS } from "../scoreSession";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const DB = {} as never;
const args = { sessionId: "s1", companyId: "co1", db: DB, skipIfScored: true };

/** A session that passes every gate, so the only thing under test is the failure being injected. */
const sellingSession = {
  id: "s1",
  sessionKind: "sales",
  agentId: "rep1",
  companyId: "co1",
  guidanceEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getSession).mockResolvedValue(sellingSession);
  asMock(getSessionTranscript).mockResolvedValue([{ speaker: "agent", text: "hello" }]);
});

describe("scoreSession returns an outcome instead of throwing", () => {
  it("survives a throwing session read", async () => {
    asMock(getSession).mockRejectedValue(new Error("PostgREST exploded"));
    const out = await scoreSession(args);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("errored");
  });

  it("survives a throwing transcript read", async () => {
    asMock(getSessionTranscript).mockRejectedValue(new Error("transcript blew up"));
    const out = await scoreSession(args);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("errored");
  });

  it("survives a throwing LLM call — the one that actually happened", async () => {
    asMock(generatePitchScore).mockRejectedValue(new Error("429 rate limited"));
    const out = await scoreSession(args);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("errored");
  });

  it("survives a throwing write", async () => {
    asMock(generatePitchScore).mockResolvedValue({ score: { total: 71 }, events: [] });
    asMock(storePitchScore).mockRejectedValue(new Error("insert failed"));
    const out = await scoreSession(args);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("errored");
  });

  it("never leaks the exception's text to the caller (CWE-209)", async () => {
    asMock(getSession).mockRejectedValue(new Error("password=hunter2 relation coaching_sessions"));
    const out = await scoreSession(args);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      // The curated sentence, not the exception. A raw `.message` here is how a Postgres error
      // carrying schema and RLS detail reaches a browser.
      expect(out.humanMessage).not.toMatch(/hunter2|relation|coaching_sessions/);
      expect(out.humanMessage).toMatch(/fault on our side/i);
    }
  });

  it("treats `errored` as worth retrying, unlike a huddle or a missing session", () => {
    // A drain that marks a provider blip permanent abandons recordings that would score on the
    // next pass; one that marks a huddle retryable grinds on it forever.
    expect(PERMANENT_REFUSALS.has("errored")).toBe(false);
    expect(PERMANENT_REFUSALS.has("not_a_sales_call")).toBe(true);
    expect(PERMANENT_REFUSALS.has("no_agent_turns")).toBe(true);
  });
});
