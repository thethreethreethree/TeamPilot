import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The engine's contract is mostly about what it does when things go WRONG.
 *
 * There is no zero-score failure path, and that is the point. This codebase has twice shipped a
 * blank LLM answer that became an honest-looking empty state, with nothing in the logs. Here the
 * same bug would store a Pitch Score of 0 and "didn't reach Discovery" against a real rep, count
 * it in their average, and open Pattern Interrupt findings off a recording nobody graded.
 */

vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn() }));

import { dissectCoachV5 } from "@/lib/claude";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { DEEPSEEK_NONREASONING_MODEL } from "@/lib/llm/deepseek";
import { generatePitchScore, buildPitchScoreUserMessage } from "../generatePitchScore";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const seg = (
  speaker: TranscriptSegment["speaker"],
  text: string,
  spokenAt: string | null = null,
  seq = 0
): TranscriptSegment => ({ id: `s${seq}`, sessionId: "sess", speaker, text, seq, spokenAt });

const GOOD_REPLY = JSON.stringify({
  reachedDiscovery: true,
  objectionOccurred: true,
  elements: [
    { elementId: "intro.trucks", grade: "hit", timestampS: 8, evidence: "Named the crews" },
    { elementId: "intro.who", grade: "partial", timestampS: 14, evidence: "Rushed" },
  ],
  bonuses: [{ bonusId: "bonus.directv", timestampS: 300, evidence: "Full pitch" }],
  violations: [{ violationId: "viol.talkingOver", timestampS: 120, evidence: "Cut in" }],
});

const reply = (text: string, extra: Record<string, unknown> = {}) =>
  ({ text, suppressed: false, model: "m", provider: "p", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getCurrentSalesCorpus).mockResolvedValue({ content: "Hey, I'll be super quick" });
  asMock(dissectCoachV5).mockResolvedValue(reply(GOOD_REPLY));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const run = (segments: TranscriptSegment[]) =>
  generatePitchScore({ companyId: "c1", sessionTitle: "Maple Ct", segments });

const TWO_WAY = [seg("agent", "Hey, quick one"), seg("customer", "What's this about?")];

describe("grading a pitch", () => {
  it("scores a parsed grading and returns the evidence alongside it", async () => {
    const r = await run(TWO_WAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.score.base).toBe(4.5); // intro.trucks 3 + intro.who partial 1.5
    expect(r.score.bonus).toBe(5);
    expect(r.score.violations).toBe(2);
    expect(r.elements).toHaveLength(2);
    expect(r.elements[0]).toMatchObject({ timestampS: 8, evidence: "Named the crews" });
  });

  it("uses the NON-reasoning model", async () => {
    // Load-bearing, not stylistic. A full grading measures ~1,440 tokens typical / ~1,785 worst
    // case; the reasoning model spends most of the 8,000 ceiling before writing anything, which is
    // how the 2026-07-30 and 2026-08-13 blank-output incidents happened. Pinned so a future edit
    // has to argue with a test rather than quietly drop it.
    await run(TWO_WAY);
    expect(asMock(dissectCoachV5).mock.calls[0]![0]).toMatchObject({
      model: DEEPSEEK_NONREASONING_MODEL,
    });
  });

  it("passes the company corpus into the prompt, and survives without one", async () => {
    await run(TWO_WAY);
    expect(asMock(dissectCoachV5).mock.calls[0]![0].systemPrompt).toContain("Hey, I'll be super quick");

    asMock(getCurrentSalesCorpus).mockRejectedValue(new Error("corpus down"));
    const r = await run(TWO_WAY);
    // A missing script is not fatal: the rubric describes what has to land independently of it.
    expect(r.ok).toBe(true);
  });
});

describe("failure modes — none of which may look like a zero score", () => {
  it("refuses a recording with no rep turns", async () => {
    const r = await run([seg("customer", "Not interested")]);
    expect(r).toEqual({ ok: false, failure: "no_agent_turns" });
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("reports suppression from the gate's verdict rather than re-deriving it", async () => {
    asMock(dissectCoachV5).mockResolvedValue(reply("", { suppressed: true }));
    expect(await run(TWO_WAY)).toEqual({ ok: false, failure: "suppressed" });
  });

  it("reports an empty LLM answer loudly instead of scoring 0", async () => {
    asMock(dissectCoachV5).mockResolvedValue(reply("   "));
    const r = await run(TWO_WAY);
    expect(r).toEqual({ ok: false, failure: "llm_empty" });
    // The 2026-07-30 outage was invisible because nothing logged. This must be findable.
    expect(console.error).toHaveBeenCalled();
    expect(String(asMock(console.error).mock.calls[0]![0])).toMatch(/EMPTY text/);
  });

  it("reports an unparseable answer rather than scoring 0", async () => {
    asMock(dissectCoachV5).mockResolvedValue(reply("I had a look and the rep did fine."));
    const r = await run(TWO_WAY);
    expect(r).toEqual({ ok: false, failure: "parse_failed" });
    expect(console.error).toHaveBeenCalled();
  });

  it("treats a reply with no element grades as a FAILURE, not a pitch that missed everything", async () => {
    // The nastiest case, because it parses as valid JSON. Scoring it would give a real rep a 0 and
    // a "didn't reach Discovery" for a recording the model never read.
    asMock(dissectCoachV5).mockResolvedValue(
      reply(JSON.stringify({ reachedDiscovery: false, objectionOccurred: false, elements: [], bonuses: [], violations: [] }))
    );
    expect(await run(TWO_WAY)).toEqual({ ok: false, failure: "parse_failed" });
  });

  it("never returns ok:true with a score for any failure", async () => {
    for (const bad of ["", "nonsense", JSON.stringify({ elements: [] })]) {
      asMock(dissectCoachV5).mockResolvedValue(reply(bad));
      const r = await run(TWO_WAY);
      expect(r.ok).toBe(false);
      expect(r).not.toHaveProperty("score");
    }
  });
});

describe("timestamps in the transcript", () => {
  const t = (offsetS: number) => new Date(Date.UTC(2026, 8, 18, 16, 40, offsetS)).toISOString();

  it("renders offsets from the FIRST timed segment, not from wall-clock", async () => {
    // Offsets are derived against the recording's own first timed line because a pitch uploaded
    // days after it happened has a recorded_at nowhere near its audio — a bug this product has
    // already shipped once ("a call recorded on the 4th was filed as happening on the 11th").
    const { message, timestampsUnavailable } = buildPitchScoreUserMessage({
      segments: [
        seg("agent", "Hey, quick one", t(0), 0),
        seg("customer", "What's this?", t(12), 1),
        seg("agent", "Fiber in the neighborhood", t(75), 2),
      ],
    });
    expect(timestampsUnavailable).toBe(false);
    expect(message).toContain("[0:00] REP: Hey, quick one");
    expect(message).toContain("[0:12] CUSTOMER: What's this?");
    expect(message).toContain("[1:15] REP: Fiber in the neighborhood");
  });

  it("omits timestamps entirely, and says so, when no segment carries a time", () => {
    const { message, timestampsUnavailable } = buildPitchScoreUserMessage({
      segments: [seg("agent", "Hey"), seg("customer", "Hi")],
    });
    expect(timestampsUnavailable).toBe(true);
    expect(message).not.toMatch(/\[\d+:\d\d\]/);
    // Telling the model to estimate would be worse than telling it nothing: a wrong timestamp
    // sends the rep's play button to the wrong moment and the evidence reads as a lie.
    expect(message).toMatch(/Omit timestampS from every item rather than estimating/);
  });

  it("labels the rep REP and the customer CUSTOMER, so the model scores the right person", () => {
    const { message } = buildPitchScoreUserMessage({
      segments: [seg("agent", "Mine"), seg("customer", "Theirs")],
    });
    expect(message).toContain("REP: Mine");
    expect(message).toContain("CUSTOMER: Theirs");
    expect(message).toMatch(/REP is the person being scored/);
  });

  it("surfaces timestampsUnavailable on the result so callers can skip the play buttons", async () => {
    const r = await run(TWO_WAY); // fixtures carry no spokenAt
    expect(r.ok && r.timestampsUnavailable).toBe(true);
  });

  it("clamps a segment timed before the first one to 0 rather than a negative offset", () => {
    // Out-of-order spokenAt happens when a diarizer backfills. A negative seek is a crash.
    const { message } = buildPitchScoreUserMessage({
      segments: [seg("agent", "Second", t(30), 0), seg("customer", "First", t(10), 1)],
    });
    expect(message).toContain("[0:00] CUSTOMER: First");
    expect(message).not.toMatch(/\[-/);
  });
});
