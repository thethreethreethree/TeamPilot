import { describe, it, expect } from "vitest";
import { parseMeetingCue } from "../parseMeetingCue";
import { buildMeetingCueUserMessage } from "../meetingCuePrompt";
import type { MeetingAgenda, StrategyTranscriptSegment } from "../../coachingStrategy";

/**
 * Prep-up agenda integration (Meeting Coach, founder 2026-08-22): the brain reports which must-discuss topics it
 * saw COVERED in a window (parsed independently of whether a cue fires), the meeting vocab gains the
 * `uncovered_topic` trigger, and the user message renders the agenda so the coach runs the meeting toward it.
 */

describe("parseMeetingCue — coverage + the uncovered_topic trigger", () => {
  it("parses `covered` topic ids on a cue response", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "discussion", trigger: "undecided", shouldCue: true, cue: "Decide it.", covered: ["t1", "t3"] }));
    expect(d.shouldCue).toBe(true);
    expect(d.coveredTopicIds).toEqual(["t1", "t3"]);
  });

  it("parses `covered` even on a SILENT response (coverage is reported regardless of a cue)", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "discussion", trigger: "none", shouldCue: false, cue: "", covered: ["t2"] }));
    expect(d.shouldCue).toBe(false);
    expect(d.coveredTopicIds).toEqual(["t2"]);
  });

  it("dedupes + drops non-strings in `covered`; absent when not provided", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "discussion", trigger: "none", shouldCue: false, cue: "", covered: ["t1", "t1", 5, null, ""] }));
    expect(d.coveredTopicIds).toEqual(["t1"]);
    const none = parseMeetingCue(JSON.stringify({ phase: "discussion", trigger: "none", shouldCue: false, cue: "" }));
    expect(none.coveredTopicIds).toBeUndefined();
  });

  it("delivers an `uncovered_topic` cue (the trigger is in the meeting vocab)", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "wrap", trigger: "uncovered_topic", shouldCue: true, importance: "high", cue: "Raise the budget before you close." }));
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("uncovered_topic");
  });
});

describe("buildMeetingCueUserMessage — agenda rendering", () => {
  const segs: StrategyTranscriptSegment[] = [{ speaker: "Alex", text: "let's start", seq: 0 }];
  const agenda: MeetingAgenda = {
    goal: "Lock the Q3 launch date",
    topics: [
      { id: "t1", text: "launch date", covered: true },
      { id: "t2", text: "budget", covered: false },
    ],
    docContext: "[spec.pdf] the API work is the blocker",
  };

  it("renders the goal, topic ids + coverage marks, and doc context when an agenda is present", () => {
    const msg = buildMeetingCueUserMessage({ recentSegments: segs, agenda });
    expect(msg).toContain("Lock the Q3 launch date");
    expect(msg).toContain("(id: t1)");
    expect(msg).toContain("COVERED");
    expect(msg).toContain("NOT COVERED");
    expect(msg).toContain("the API work is the blocker");
  });

  it("omits the agenda block entirely when no agenda is given (prep-less meeting — no regression)", () => {
    const msg = buildMeetingCueUserMessage({ recentSegments: segs });
    expect(msg).not.toContain("PREP-UP AGENDA");
    expect(msg).toContain("Meeting so far");
  });
});
