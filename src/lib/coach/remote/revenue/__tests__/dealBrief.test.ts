import { describe, it, expect } from "vitest";
import { basisKey, parseDealBrief } from "../dealBrief";
import type { CallLines } from "../playbook";

/** The deal brief (0374; Gong F20.3, F20.4): every point cites a real line, or it isn't there. */
const calls: CallLines[] = [
  { sessionId: "s2", startedAt: "2026-11-20T10:00:00Z", lines: [{ seq: 1, speaker: "customer", text: "We need it live by March.", atMs: 2000 }, { seq: 2, speaker: "customer", text: "Price is a concern.", atMs: 9000 }] },
  { sessionId: "s1", startedAt: "2026-11-10T10:00:00Z", lines: [{ seq: 7, speaker: "rep", text: "I'll send the proposal.", atMs: 3000 }] },
];

describe("parseDealBrief", () => {
  it("keeps cited points, drops uncited ones and citations to lines that don't exist", () => {
    const raw = JSON.stringify({
      standing: "Evaluating, wants March go-live.",
      happened: [{ text: "Customer set a March deadline.", cites: [{ call: "C1", seq: 1 }] }, { text: "Made up.", cites: [] }],
      risks: [{ text: "Price concern.", cites: [{ call: 1, seq: 2 }, { call: 1, seq: 99 }] }],
      next: [{ text: "Send the proposal", cites: [{ call: "C2", seq: 7 }] }, { text: "Ghost step", cites: [{ call: 3, seq: 1 }] }],
    });
    expect(parseDealBrief(raw, calls)).toEqual({
      standing: "Evaluating, wants March go-live.",
      happened: [{ text: "Customer set a March deadline.", cites: [{ sessionId: "s2", seq: 1, atMs: 2000 }] }],
      risks: [{ text: "Price concern.", cites: [{ sessionId: "s2", seq: 2, atMs: 9000 }] }],
      next: [{ text: "Send the proposal", cites: [{ sessionId: "s1", seq: 7, atMs: 3000 }] }],
    });
  });
  it("a standing line with no point behind it is dropped", () => {
    expect(parseDealBrief(JSON.stringify({ standing: "Going great!", happened: [], risks: [], next: [] }), calls)).toEqual({ standing: "", happened: [], risks: [], next: [] });
  });
  it("an unusable reply is null (not stored), not an empty brief", () => {
    expect(parseDealBrief("not json", calls)).toBeNull();
    expect(parseDealBrief('{"standing": "x"', calls)).toBeNull();
    expect(parseDealBrief('{"standing": "only this"}', calls)).toBeNull();
  });
});

describe("basisKey", () => {
  it("the same calls and versions in any order are the same basis; a new version is a new one", () => {
    expect(basisKey([{ sessionId: "b", version: 1 }, { sessionId: "a", version: 2 }])).toBe(basisKey([{ sessionId: "a", version: 2 }, { sessionId: "b", version: 1 }]));
    expect(basisKey([{ sessionId: "a", version: 3 }])).not.toBe(basisKey([{ sessionId: "a", version: 2 }]));
  });
});
