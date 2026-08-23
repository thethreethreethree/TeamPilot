import { describe, it, expect } from "vitest";
import { parseHuddleCue } from "../parseHuddleCue";
import { buildHuddleCueUserMessage } from "../huddleCuePrompt";
import type { MeetingAgenda, StrategyTranscriptSegment } from "../../coachingStrategy";

/**
 * Prep-up agenda integration for the HUDDLE brain (audit D1, founder 2026-08-23). A huddle can be prepped too and
 * the Dissect already judges its agenda coverage — so the live huddle brain must track coverage + flag a must-cover
 * point missed at the end, mirroring the meeting brain but keeping the huddle's near-silent posture (the agenda
 * adds exactly ONE reason to speak: an uncovered point as the huddle closes). These pin that contract AND the
 * no-regression case: a prep-less huddle renders NO agenda block, so today's tight behaviour is untouched.
 */

describe("parseHuddleCue — coverage + the uncovered_topic trigger (now in huddle vocab)", () => {
  it("delivers an `uncovered_topic` cue (the trigger is now valid huddle vocab)", () => {
    const d = parseHuddleCue(
      JSON.stringify({ phase: "wrap", trigger: "uncovered_topic", shouldCue: true, importance: "high", cue: "Before we close — any update on the deploy?" })
    );
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("uncovered_topic");
  });

  it("parses `covered` point ids even on a SILENT pass (coverage accumulates regardless of a cue)", () => {
    const d = parseHuddleCue(JSON.stringify({ phase: "status_round", trigger: "none", shouldCue: false, cue: "", covered: ["t1", "t2"] }));
    expect(d.shouldCue).toBe(false);
    expect(d.coveredTopicIds).toEqual(["t1", "t2"]);
  });
});

describe("buildHuddleCueUserMessage — agenda rendering (tight)", () => {
  const segs: StrategyTranscriptSegment[] = [{ speaker: "Sam", text: "quick standup", seq: 0 }];
  const agenda: MeetingAgenda = {
    goal: "Unblock the release",
    topics: [
      { id: "t1", text: "deploy status", covered: true },
      { id: "t2", text: "QA sign-off", covered: false },
    ],
    docContext: "[notes] staging is green",
  };

  it("renders must-cover points, ids + coverage marks, and doc context when an agenda is present", () => {
    const msg = buildHuddleCueUserMessage({ recentSegments: segs, agenda });
    expect(msg).toContain("PREP-UP AGENDA");
    expect(msg).toContain("Unblock the release");
    expect(msg).toContain("(id: t2)");
    expect(msg).toContain("COVERED");
    expect(msg).toContain("NOT COVERED");
    expect(msg).toContain("staging is green");
  });

  it("omits the agenda block ENTIRELY for a prep-less huddle (no regression to the tight default)", () => {
    const msg = buildHuddleCueUserMessage({ recentSegments: segs });
    expect(msg).not.toContain("PREP-UP AGENDA");
    expect(msg).toContain("Huddle so far");
  });

  it("mentions uncovered_topic in the wrap note ONLY when an agenda is present", () => {
    expect(buildHuddleCueUserMessage({ recentSegments: segs, nearingEnd: true, agenda })).toContain("uncovered_topic");
    expect(buildHuddleCueUserMessage({ recentSegments: segs, nearingEnd: true })).not.toContain("uncovered_topic");
  });
});
