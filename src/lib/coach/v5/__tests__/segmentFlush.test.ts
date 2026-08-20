import { describe, it, expect } from "vitest";
import { selectUnflushedSegments, type FlushTurn } from "../segmentFlush";

const T = (text: string, speaker: FlushTurn["speaker"], pending = false, source?: string): FlushTurn => ({ text, speaker, pending, source });

describe("selectUnflushedSegments (incremental transcript persistence)", () => {
  it("flushes only SETTLED, non-empty, not-yet-flushed turns; seq = index", () => {
    const turns = [T("hi", "agent"), T("thinking", "customer", true), T("yes", "customer")];
    const segs = selectUnflushedSegments(turns, new Set());
    expect(segs).toEqual([
      { speaker: "agent", text: "hi", seq: 0 },
      { speaker: "customer", text: "yes", seq: 2 }, // index 1 held back (pending)
    ]);
  });

  it("skips turns already flushed (idempotent — never re-sends a persisted seq)", () => {
    const turns = [T("a", "agent"), T("b", "customer")];
    expect(selectUnflushedSegments(turns, new Set([0]))).toEqual([{ speaker: "customer", text: "b", seq: 1 }]);
    expect(selectUnflushedSegments(turns, new Set([0, 1]))).toEqual([]);
  });

  it("includePending (stop / tab-close) flushes still-pending turns rather than losing them", () => {
    const turns = [T("a", "agent"), T("provisional", "customer", true)];
    expect(selectUnflushedSegments(turns, new Set(), true)).toEqual([
      { speaker: "agent", text: "a", seq: 0 },
      { speaker: "customer", text: "provisional", seq: 1 },
    ]);
  });

  it("carries the attribution source when present (diagnosability)", () => {
    const turns = [T("locked turn", "agent", false, "manual")];
    expect(selectUnflushedSegments(turns, new Set())).toEqual([{ speaker: "agent", text: "locked turn", seq: 0, source: "manual" }]);
  });

  it("drops empty/whitespace turns", () => {
    expect(selectUnflushedSegments([T("   ", "agent"), T("", "customer")], new Set())).toEqual([]);
  });
});
