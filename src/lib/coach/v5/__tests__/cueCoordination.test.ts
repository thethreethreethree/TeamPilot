import { describe, expect, it } from "vitest";
import {
  shouldScheduleCueAtCommit,
  reconcileCueAfterClassify,
} from "../cueCoordination";

/**
 * Pins the L2 cue-coordination — the session's most timing-sensitive path (a
 * cue scheduled at commit, AHEAD of the LLM). Regression-protects the exact
 * conditionals audited on 2026-07-06 (AUDIT-2026-07-06-sales-coach-live-attribution).
 */
describe("shouldScheduleCueAtCommit", () => {
  it("schedules for an auto-coach, unlocked, obvious-prospect turn", () => {
    expect(
      shouldScheduleCueAtCommit({ locked: false, contentGuess: "customer", autoCoach: true })
    ).toBe(true);
  });
  it("does NOT schedule when the rep is manually locked as speaking", () => {
    expect(
      shouldScheduleCueAtCommit({ locked: true, contentGuess: "customer", autoCoach: true })
    ).toBe(false);
  });
  it("does NOT schedule on an agent turn or an ambiguous (null) content tell", () => {
    expect(
      shouldScheduleCueAtCommit({ locked: false, contentGuess: "agent", autoCoach: true })
    ).toBe(false);
    expect(
      shouldScheduleCueAtCommit({ locked: false, contentGuess: null, autoCoach: true })
    ).toBe(false);
  });
  it("does NOT schedule when auto-coach is off", () => {
    expect(
      shouldScheduleCueAtCommit({ locked: false, contentGuess: "customer", autoCoach: false })
    ).toBe(false);
  });
});

describe("reconcileCueAfterClassify", () => {
  const base = {
    scheduledAtCommit: false,
    finalSpeaker: "customer" as "agent" | "customer" | null,
    isLatestTurn: true,
    autoCoach: true,
  };

  it("keeps the commit-scheduled cue when the LLM agrees (don't reset — saves latency)", () => {
    expect(reconcileCueAfterClassify({ ...base, scheduledAtCommit: true })).toBe("keep");
  });
  it("schedules when the LLM is the FIRST to determine prospect", () => {
    expect(reconcileCueAfterClassify({ ...base, scheduledAtCommit: false })).toBe("schedule");
  });
  it("cancels a commit-scheduled cue when the LLM DISAGREES (agent)", () => {
    expect(
      reconcileCueAfterClassify({ ...base, scheduledAtCommit: true, finalSpeaker: "agent" })
    ).toBe("cancel");
  });
  it("does nothing when nothing was scheduled and the LLM says agent", () => {
    expect(
      reconcileCueAfterClassify({ ...base, scheduledAtCommit: false, finalSpeaker: "agent" })
    ).toBe("none");
  });
  it("does NOT re-schedule a superseded (non-latest) prospect turn", () => {
    // A newer commit supersedes; it runs its own trigger. Never "schedule" here.
    expect(
      reconcileCueAfterClassify({ ...base, scheduledAtCommit: false, isLatestTurn: false })
    ).toBe("none");
  });
  it("does NOT schedule when auto-coach is off", () => {
    expect(
      reconcileCueAfterClassify({ ...base, scheduledAtCommit: false, autoCoach: false })
    ).toBe("none");
  });
});
