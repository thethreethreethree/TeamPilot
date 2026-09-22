import { describe, it, expect } from "vitest";
import {
  keyMoments,
  momentCoverage,
  transcriptWindow,
  timedLines,
  linesAround,
  type MomentSource,
} from "../keyMoments";

/**
 * The markers a manager scrubs a recording by.
 *
 * The derivation is a merge and a sort. What these tests pin is the handful of decisions inside
 * it that would each produce a plausible, wrong picture of a pitch:
 *
 *   · a null timestamp coerced to 0, stacking every unplaced moment at the opening
 *   · every graded element marked, so three problems hide among thirty ticks
 *   · a violation's stored positive deduction rendered as points gained
 *   · a repeated miss shown as an ordinary one, losing the distinction the brown marker exists for
 */

const el = (over: Partial<MomentSource["elements"][number]> = {}) => ({
  id: "e1",
  elementId: "intro.trucks",
  grade: "missed" as const,
  points: 0,
  timestampS: 12,
  evidence: "Opened with a question",
  ...over,
});

const ev = (over: Partial<MomentSource["events"][number]> = {}) => ({
  id: "v1",
  type: "violation" as const,
  itemId: "viol.talkingOver",
  points: 2,
  timestampS: 312,
  evidence: "Cut in on the deposit question",
  ...over,
});

const src = (over: Partial<MomentSource> = {}): MomentSource => ({
  elements: [],
  events: [],
  ...over,
});

describe("what gets a marker", () => {
  it("marks a missed element with what it cost", () => {
    const [m] = keyMoments(src({ elements: [el()] }));
    expect(m).toMatchObject({ kind: "missed", atSeconds: 12, label: "Trucks / neighborhood notice" });
    // intro.trucks is worth 3; a miss scores zero, so the moment cost 3.
    expect(m!.points).toBe(-3);
  });

  it("does NOT mark a hit", () => {
    // Thirty green ticks and three red ones is the same information as three red ones, and much
    // harder to read. The board's strip shows flagged moments.
    expect(keyMoments(src({ elements: [el({ grade: "hit" })] }))).toEqual([]);
  });

  it("does not mark a Partial either", () => {
    // It is on the Pitch detail with its half-points. A manager scrubbing for problems is looking
    // for what did not land at all.
    expect(keyMoments(src({ elements: [el({ grade: "partial" })] }))).toEqual([]);
  });

  it("renders a violation as points LOST, not gained", () => {
    // Stored as a positive deduction. On a timeline it has to read as what it took.
    const [m] = keyMoments(src({ events: [ev()] }));
    expect(m!.kind).toBe("violation");
    expect(m!.points).toBe(-2);
  });

  it("renders a bonus as points gained", () => {
    const [m] = keyMoments(src({ events: [ev({ id: "b1", type: "bonus", itemId: "bonus.icebreaker", points: 3 })] }));
    expect(m).toMatchObject({ kind: "bonus", points: 3 });
  });

  it("includes a manager comment, with no points", () => {
    const [m] = keyMoments(
      src({ comments: [{ id: "c1", timestampS: 442, body: "What should the rep hear here?", authorLabel: "Manager · Sep 18" }] })
    );
    expect(m).toMatchObject({ kind: "comment", atSeconds: 442, points: null });
    expect(m!.detail).toBe("What should the rep hear here?");
  });

  it("falls back to the raw id for an item no longer in the rubric", () => {
    const [m] = keyMoments(src({ elements: [el({ elementId: "gone.retired" })] }));
    expect(m!.label).toBe("gone.retired");
    // No rubric entry means no known value — null, never a guessed zero.
    expect(m!.points).toBeNull();
  });
});

describe("a repeated miss is a different marker from a one-off", () => {
  it("marks it as a pattern when the rep has an open pattern on that item", () => {
    // One is a bad moment; the other is the fifth time this month. A manager listens to them
    // differently, which is why the board gives them different colours.
    const [m] = keyMoments(src({ elements: [el()], patternItemIds: ["intro.trucks"] }));
    expect(m!.kind).toBe("pattern");
  });

  it("leaves an unrelated miss as a plain miss", () => {
    const [m] = keyMoments(src({ elements: [el()], patternItemIds: ["close.paperwork"] }));
    expect(m!.kind).toBe("missed");
  });
});

describe("a moment with no timestamp is kept, not placed at zero", () => {
  it("keeps atSeconds null rather than coercing it", () => {
    // The scorer has a timestampsUnavailable path. Coercing to 0 stacks every unplaced moment at
    // the start of the waveform, which renders as a catastrophic opening and is an artefact.
    const [m] = keyMoments(src({ elements: [el({ timestampS: null })] }));
    expect(m!.atSeconds).toBeNull();
  });

  it("sorts unplaced moments last, so playback order reads straight through", () => {
    const ms = keyMoments(
      src({
        elements: [
          el({ id: "late", timestampS: 400 }),
          el({ id: "nowhere", timestampS: null }),
          el({ id: "early", timestampS: 10 }),
        ],
      })
    );
    expect(ms.map((m) => m.id)).toEqual(["early", "late", "nowhere"]);
  });

  it("reports BOTH counts, because they are different facts", () => {
    const ms = keyMoments(
      src({ elements: [el({ id: "a" }), el({ id: "b", timestampS: null }), el({ id: "c", timestampS: null })] })
    );
    // Eight flagged moments of which three are placeable is not three flagged moments. A strip
    // that shows only the placeable ones agrees with itself and disagrees with the pitch.
    expect(momentCoverage(ms)).toEqual({ total: 3, placeable: 1, unplaced: 2 });
  });
});

describe("ordering", () => {
  it("is by time, mixing elements, events and comments into one timeline", () => {
    const ms = keyMoments(
      src({
        elements: [el({ id: "e", timestampS: 100 })],
        events: [ev({ id: "v", timestampS: 50 })],
        comments: [{ id: "c", timestampS: 75, body: "x", authorLabel: "Manager" }],
      })
    );
    expect(ms.map((m) => m.id)).toEqual(["v", "c", "e"]);
  });

  it("is stable when two moments share a second", () => {
    const ms = keyMoments(src({ elements: [el({ id: "zz" }), el({ id: "aa" })] }));
    expect(ms.map((m) => m.id)).toEqual(["aa", "zz"]);
  });
});

describe("the transcript window is honest about not knowing when a line was said", () => {
  const text = ["one", "two", "three", "four", "five", "six", "seven"].join("\n");

  it("returns a window around the playhead's POSITION, always marked approximate", () => {
    // The transcript is one text column with no speaker turns and no timings. Inventing a second
    // per line would put a specific wrong number next to a quote a manager reads out loud.
    const w = transcriptWindow(text, 50, 100, 1);
    expect(w!.approximate).toBe(true);
    expect(w!.lines).toEqual(["three", "four", "five"]);
    expect(w!.lines[w!.focusIndex]).toBe("four");
  });

  it("clamps at the start and the end rather than returning a short window off the edge", () => {
    expect(transcriptWindow(text, 0, 100, 2)!.lines[0]).toBe("one");
    expect(transcriptWindow(text, 100, 100, 2)!.lines.at(-1)).toBe("seven");
  });

  it("still returns something when the duration is unknown", () => {
    const w = transcriptWindow(text, 30, null, 1);
    expect(w!.lines.length).toBeGreaterThan(0);
    expect(w!.approximate).toBe(true);
  });

  it("says nothing when there is no transcript", () => {
    expect(transcriptWindow(null, 10, 100)).toBeNull();
    expect(transcriptWindow("   \n  \n", 10, 100)).toBeNull();
  });
});

describe("timed lines — the founder's ruling, met by the schema that already had them", () => {
  const seg = (seq: number, speaker: string, text: string, spokenAt: string | null) => ({
    seq,
    speaker,
    text,
    spokenAt,
  });
  const START = "2026-03-10T16:40:00Z";

  it("converts a wall clock into seconds from the start of the recording", () => {
    const [l] = timedLines([seg(1, "agent", "Hey, I'll be super quick", "2026-03-10T16:40:12Z")], START);
    expect(l).toMatchObject({ speaker: "agent", atSeconds: 12 });
  });

  it("keeps a line with no clock rather than placing it at zero", () => {
    // Same rule as a marker: a line placed at 0 because nobody timed it is worse than one placed
    // nowhere, because 0 is a specific claim about the opening.
    const [l] = timedLines([seg(1, "agent", "untimed", null)], START);
    expect(l!.atSeconds).toBeNull();
  });

  it("gives up on the offset when the recording has no start", () => {
    expect(timedLines([seg(1, "agent", "x", "2026-03-10T16:40:12Z")], null)[0]!.atSeconds).toBeNull();
  });

  it("refuses a segment that predates the recording rather than going negative", () => {
    expect(timedLines([seg(1, "agent", "x", "2026-03-10T16:39:00Z")], START)[0]!.atSeconds).toBeNull();
  });

  it("orders by SEQ, not by time", () => {
    // seq is monotonic and assigned by the feed; two segments can share a spoken_at or arrive out
    // of order, and a transcript reordered by timestamp reads as a different conversation.
    const ls = timedLines(
      [seg(2, "customer", "second", "2026-03-10T16:40:05Z"), seg(1, "agent", "first", "2026-03-10T16:40:09Z")],
      START
    );
    expect(ls.map((l) => l.text)).toEqual(["first", "second"]);
  });

  it("normalises an unknown speaker rather than passing it through", () => {
    expect(timedLines([seg(1, "robot", "x", null)], START)[0]!.speaker).toBe("unknown");
  });
});

describe("the window around a moment", () => {
  const L = (atSeconds: number | null, text: string) => ({ speaker: "agent" as const, text, atSeconds });

  it("focuses the last line that had started by then", () => {
    const w = linesAround([L(0, "a"), L(10, "b"), L(20, "c"), L(30, "d")], 22, 1);
    expect(w!.lines[w!.focusIndex]!.text).toBe("c");
  });

  it("focuses the first line when the moment precedes every line", () => {
    const w = linesAround([L(50, "a"), L(60, "b")], 10, 1);
    expect(w!.focusIndex).toBe(0);
  });

  it("keeps untimed lines in the window rather than dropping a turn", () => {
    // Dropping them would silently remove a turn from a conversation a manager is reading out.
    const w = linesAround([L(0, "a"), L(null, "untimed"), L(20, "c")], 20, 2);
    expect(w!.lines.map((l) => l.text)).toContain("untimed");
  });

  it("never FOCUSES an untimed line, because it could be anywhere", () => {
    // Found by mutation. An untimed line is shown in the window and must not be the one the
    // panel highlights as "here" — highlighting it would point a manager at a quote with no
    // claim to being at that moment, which is the same fabrication the null timestamps avoid.
    const w = linesAround([L(0, "a"), L(10, "b"), L(null, "untimed")], 30, 2);
    expect(w!.lines[w!.focusIndex]!.text).toBe("b");
    expect(w!.lines[w!.focusIndex]!.atSeconds).not.toBeNull();
  });

  it("says nothing when there is no transcript", () => {
    expect(linesAround([], 10)).toBeNull();
  });
});
