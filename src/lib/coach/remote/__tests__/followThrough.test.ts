import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claude", () => ({ followThroughCoach: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { numberedTranscript, parseFollowThrough, type Line } from "../followThrough";

const lines: Line[] = [
  { seq: 1, speaker: "rep", text: "Thanks for taking the call.", atMs: 0 },
  { seq: 2, speaker: "customer", text: "Call me back Thursday, I need to check with my wife.", atMs: 65_000 },
  { seq: 3, speaker: "rep", text: "I'll send the quote tonight.", atMs: 80_000 },
];
const callDate = new Date("2026-11-20T15:00:00Z");
const json = (o: unknown) => JSON.stringify(o);

describe("numberedTranscript", () => {
  it("numbers each line with its seq and time", () => {
    expect(numberedTranscript(lines).split("\n")[1]).toBe("[2] (1:05) CUSTOMER: Call me back Thursday, I need to check with my wife.");
  });
});

describe("parseFollowThrough — the transcript decides what survives", () => {
  it("keeps a callback whose quote is in its line, with a real date", () => {
    const r = parseFollowThrough(
      json({ outcome: { value: "follow_up", why: "Asked for a callback.", seq: 2 }, callbacks: [{ what: "Call back", due: "2026-11-26", quote: "call me back Thursday", seq: 2 }] }),
      lines,
      callDate,
    );
    expect(r.suggestedOutcome).toBe("follow_up");
    expect(r.outcomeSeq).toBe(2);
    expect(r.callbacks).toEqual([{ what: "Call back", due: "2026-11-26", quote: "call me back Thursday", seq: 2, atMs: 65_000 }]);
  });
  it("drops a callback whose quote is not in the line it cites (invented)", () => {
    const r = parseFollowThrough(json({ outcome: null, callbacks: [{ what: "Send contract", due: null, quote: "send me the contract", seq: 2 }] }), lines, callDate);
    expect(r.callbacks).toEqual([]);
  });
  it("a date before the call or past 180 days becomes null, not a guess", () => {
    const r = parseFollowThrough(
      json({ callbacks: [
        { what: "a", due: "2026-10-01", quote: "send the quote tonight", seq: 3 },
        { what: "b", due: "2027-12-01", quote: "send the quote tonight", seq: 3 },
      ] }),
      lines,
      callDate,
    );
    expect(r.callbacks.map((c) => c.due)).toEqual([null, null]);
  });
  it("an unknown outcome or a seq that is not a line → no suggestion", () => {
    expect(parseFollowThrough(json({ outcome: { value: "maybe", seq: 2 } }), lines, callDate).suggestedOutcome).toBeNull();
    expect(parseFollowThrough(json({ outcome: { value: "sold", seq: 99 } }), lines, callDate).suggestedOutcome).toBeNull();
  });
  it("not JSON → empty read (never a throw)", () => {
    expect(parseFollowThrough("sorry", lines, callDate)).toEqual({ suggestedOutcome: null, why: null, outcomeSeq: null, callbacks: [] });
  });
  it("caps callbacks at 5", () => {
    const many = Array.from({ length: 8 }, () => ({ what: "x", due: null, quote: "quote tonight", seq: 3 }));
    expect(parseFollowThrough(json({ callbacks: many }), lines, callDate).callbacks).toHaveLength(5);
  });
});
