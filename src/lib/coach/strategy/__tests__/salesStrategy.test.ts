import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SalesStrategy is the Phase-2 step-2 adapter: the existing sales cue brain expressed as a CoachingStrategy,
 * over the UNCHANGED generateLiveCue. This test is a DRIFT GUARD on the mapping between the generalized
 * CoachingStrategy inputs and the REAL generateLiveCue arg NAMES. The names differ on purpose (stall→stalled,
 * 'directive'→'guide_response', wearerId→agentId, sessionKind→context, signals.confidence→confidenceLevel), and
 * a silent break in any of them would change live coaching the moment the seam is wired (step 3). Lock it now,
 * while the adapter is still unwired, so the wiring can't regress it unnoticed. generateLiveCue is mocked — this
 * tests the ADAPTER's mapping, not the brain.
 */

const generateLiveCue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/v5/liveCue", () => ({ generateLiveCue }));

const { SalesStrategy } = await import("../salesStrategy");

beforeEach(() => {
  generateLiveCue.mockReset();
  generateLiveCue.mockResolvedValue({
    shouldCue: true,
    mode: "suggestion",
    cue: "Ask about their timeline.",
    phase: "discovery",
    trigger: "buying_signal",
    importance: "high",
  });
});

describe("SalesStrategy — CoachingStrategy → generateLiveCue mapping (drift guard)", () => {
  it("maps every context field to the sales arg NAME the engine expects", async () => {
    await new SalesStrategy().analyze(
      [
        { speaker: "agent", text: "Hi there", seq: 0, spokenAt: null },
        { speaker: "customer", text: "Tell me more", seq: 1, spokenAt: "2026-08-21T00:00:00Z" },
        { speaker: "moderator", text: "??", seq: 2 }, // an N-party speaker → narrows to the sales 'unknown'
      ],
      {
        sessionKind: "video",
        companyId: "co-1",
        wearerId: "rep-1",
        mode: "directive",
        force: true,
        stall: true,
        signals: { stress: { fillerSpike: true, paceSpike: false }, confidence: "wavering" },
      }
    );
    expect(generateLiveCue).toHaveBeenCalledTimes(1);
    const arg = generateLiveCue.mock.calls[0]?.[0];
    expect(arg.companyId).toBe("co-1");
    expect(arg.agentId).toBe("rep-1"); // wearerId → agentId
    expect(arg.mode).toBe("guide_response"); // 'directive' → 'guide_response'
    expect(arg.context).toBe("video"); // sessionKind → context
    expect(arg.force).toBe(true);
    expect(arg.stalled).toBe(true); // stall → stalled
    expect(arg.stress).toEqual({ fillerSpike: true, paceSpike: false });
    expect(arg.confidenceLevel).toBe("wavering"); // signals.confidence → confidenceLevel
    expect(arg.segments[2].speaker).toBe("unknown"); // N-party speaker narrowed to the 2-party enum
    expect(arg.segments[1].spokenAt).toBe("2026-08-21T00:00:00Z");
  });

  it("maps 'suggestion' mode and defaults a non-'video' sessionKind to in_person; omits absent hints", async () => {
    await new SalesStrategy().analyze([], { sessionKind: "in_person", companyId: "co", mode: "suggestion" });
    const arg = generateLiveCue.mock.calls[0]?.[0];
    expect(arg.mode).toBe("suggestion");
    expect(arg.context).toBe("in_person");
    expect(arg.agentId).toBeUndefined();
    expect(arg.stalled).toBeUndefined();
    expect(arg.stress).toBeUndefined();
    expect(arg.confidenceLevel).toBeUndefined();
  });

  it("maps the LiveCueResult back to a CueDecision (empty cue → null)", async () => {
    generateLiveCue.mockResolvedValueOnce({
      shouldCue: false,
      mode: "suggestion",
      cue: "",
      phase: "unknown",
      trigger: "none",
      importance: "low",
    });
    const d = await new SalesStrategy().analyze([], {
      sessionKind: "in_person",
      companyId: "co",
      mode: "suggestion",
    });
    expect(d).toEqual({ shouldCue: false, cue: null, trigger: "none", phase: "unknown", importance: "low" });
  });

  it("VALIDATES hint signals — a malformed stress/confidence becomes undefined, never a guessed signal (§3.2)", async () => {
    await new SalesStrategy().analyze([], {
      sessionKind: "in_person",
      companyId: "co",
      mode: "suggestion",
      signals: { confidence: "super-confident", stress: "nope" }, // both malformed
    });
    const arg = generateLiveCue.mock.calls[0]?.[0];
    expect(arg.confidenceLevel).toBeUndefined();
    expect(arg.stress).toBeUndefined(); // NOT passed through as a bogus signal
  });
});
