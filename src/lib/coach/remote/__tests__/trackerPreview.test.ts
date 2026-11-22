import { describe, it, expect } from "vitest";
import { previewTracker, TrackerError, type PreviewCall } from "../trackers";

/**
 * F11.4 — previewing a tracker on recent calls before saving. It must agree with the real scan (same matcher: whole
 * words, the chosen side), count calls and phrases honestly, and not let one chatty call fill the examples.
 */
const call = (id: string, lines: Array<[speaker: "rep" | "customer" | "unknown", text: string]>): PreviewCall => ({
  sessionId: id,
  label: `Call ${id}`,
  startedAt: "2026-11-20T10:00:00Z",
  segments: lines.map(([speaker, text], i) => ({ speaker, text, startMs: i * 5000, seq: i + 1 })),
});

const CALLS = [
  call("a", [["customer", "We already use Spectrum"], ["customer", "Spectrum is cheaper"], ["rep", "Fair, but on price…"]]),
  call("b", [["customer", "Is this xfinity?"], ["rep", "No, and the price is fixed"]]),
  call("c", [["rep", "Spectrumized is not a word"], ["customer", "Price matters to me"]]),
];

describe("previewTracker", () => {
  it("counts mentions and calls with the real matcher — whole words, the chosen side only", () => {
    const p = previewTracker({ name: "Competitors", phrases: ["spectrum", "Xfinity"], side: "customer" }, CALLS);
    expect(p.callsChecked).toBe(3);
    expect(p.callsWithHits).toBe(2); // "Spectrumized" (call c) is not a whole-word match
    expect(p.hitCount).toBe(3);
    expect(p.perPhrase).toEqual([
      { phrase: "spectrum", hits: 2, calls: 1 },
      { phrase: "xfinity", hits: 1, calls: 1 },
    ]);
  });

  it("gives one example per call, with the line and its time", () => {
    const p = previewTracker({ name: "Competitors", phrases: ["spectrum", "xfinity"], side: "any" }, CALLS);
    expect(p.examples.map((e) => e.sessionId)).toEqual(["a", "b"]);
    expect(p.examples[0]).toMatchObject({ matched: "spectrum", text: "We already use Spectrum", atMs: 0, speaker: "customer" });
  });

  it("shows a phrase that hits most calls, so a manager sees it is too common before saving", () => {
    const p = previewTracker({ name: "Price", phrases: ["price"], side: "any" }, CALLS);
    expect(p.perPhrase[0]).toEqual({ phrase: "price", hits: 3, calls: 3 });
  });

  it("refuses a phrase list exactly as saving would", () => {
    expect(() => previewTracker({ name: "x", phrases: ["a"], side: "any" }, CALLS)).toThrow(TrackerError);
    expect(() => previewTracker({ name: "x", phrases: ["  "], side: "any" }, CALLS)).toThrow(TrackerError);
  });

  it("with no calls, says so rather than inventing a rate", () => {
    expect(previewTracker({ name: "x", phrases: ["spectrum"], side: "any" }, [])).toEqual({
      callsChecked: 0, callsWithHits: 0, hitCount: 0, perPhrase: [{ phrase: "spectrum", hits: 0, calls: 0 }], examples: [],
    });
  });
});
