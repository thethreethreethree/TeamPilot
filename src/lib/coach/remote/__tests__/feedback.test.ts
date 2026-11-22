import { describe, it, expect } from "vitest";
import {
  allManagerActions,
  closesUnderEveryPolicy,
  countsAsFeedback,
  counted,
  gongRules,
  isRequestOpen,
  listenedSeconds,
  parseListenRange,
  type CoachingEvent,
} from "../feedback";

const at = (iso: string) => new Date(iso);
const ALL_KINDS: CoachingEvent[] = [
  { kind: "comment_sent_to_rep", managerId: "m", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
  { kind: "comment_draft", managerId: "m", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
  { kind: "score_override", managerId: "m", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
  { kind: "dispute_answered", managerId: "m", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
  { kind: "pattern_coached", managerId: "m", repId: "r", at: at("2026-11-20T10:00:00Z") },
  { kind: "ai_score", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
  { kind: "own_session_action", managerId: "r", repId: "r", at: at("2026-11-20T10:00:00Z"), sessionId: "s" },
];

describe("closesUnderEveryPolicy — what closes a request before D8", () => {
  it("implies BOTH D8 options, for every event kind (it can never close a request a decided D8 would call unanswered)", () => {
    for (const e of ALL_KINDS) {
      if (closesUnderEveryPolicy(e)) {
        expect(gongRules(e)).toBe(true);
        expect(allManagerActions(e)).toBe(true);
      }
    }
  });
  it("a sent comment, an override and a dispute answer close; a draft, an AI score and acting on your own call do not", () => {
    const closes = ALL_KINDS.filter(closesUnderEveryPolicy).map((e) => e.kind);
    expect(closes).toEqual(["comment_sent_to_rep", "score_override", "dispute_answered"]);
  });
});

describe("isRequestOpen", () => {
  const req = { sessionId: "s", managerId: "m" as string | null, requesterId: "r", createdAt: at("2026-11-20T09:00:00Z") };
  it("closed by the named manager's sent comment after the request", () => {
    expect(isRequestOpen(req, [ALL_KINDS[0]!])).toBe(false);
  });
  it("stays open for an action BEFORE the request, on another call, or by a different manager", () => {
    const before = { ...ALL_KINDS[0], at: at("2026-11-20T08:00:00Z") } as CoachingEvent;
    const other = { ...ALL_KINDS[0], sessionId: "s2" } as CoachingEvent;
    const someoneElse = { ...ALL_KINDS[0], managerId: "m2" } as CoachingEvent;
    expect(isRequestOpen(req, [before, other, someoneElse])).toBe(true);
  });
  it("stays open for a draft (never reached the rep)", () => {
    expect(isRequestOpen(req, [ALL_KINDS[1]!])).toBe(true);
  });
  it("addressed to 'my managers' (null): any manager's qualifying action closes it, but never the rep's own", () => {
    const anyone = { ...req, managerId: null };
    expect(isRequestOpen(anyone, [{ ...ALL_KINDS[2], managerId: "m9" } as CoachingEvent])).toBe(false);
    expect(isRequestOpen(anyone, [{ ...ALL_KINDS[0], managerId: "r" } as CoachingEvent])).toBe(true);
  });
});

describe("listening", () => {
  it("merges overlaps and replays once", () => {
    expect(listenedSeconds([[0, 10_000], [5_000, 15_000], [0, 2_000], [20_000, 21_000]])).toBe(16);
  });
  it("ignores empty or backward ranges", () => {
    expect(listenedSeconds([[5, 5], [10, 2]])).toBe(0);
  });
  it("parseListenRange refuses negative, backward, non-numeric and >6h ranges; rounds ms", () => {
    expect(parseListenRange(0.4, 1500.6)).toEqual([0, 1501]);
    expect(parseListenRange(-1, 10)).toBeNull();
    expect(parseListenRange(10, 10)).toBeNull();
    expect(parseListenRange("x", 10)).toBeNull();
    expect(parseListenRange(0, 7 * 3600 * 1000)).toBeNull();
  });
});

describe("D8 as decided by the founder (2026-11-22): deliberate coaching; listened = half the call", () => {
  it("a sent comment, a correction and a dispute answer count; an unsent draft does not", () => {
    const byKind = (k: string) => countsAsFeedback(ALL_KINDS.find((e) => e.kind === k)!);
    expect(byKind("comment_sent_to_rep")).toBe(true);
    expect(byKind("score_override")).toBe(true);
    expect(byKind("dispute_answered")).toBe(true);
    expect(byKind("comment_draft")).toBe(false);
  });
  it("playing half the call counts as listened; less does not", () => {
    expect(counted([[0, 600_000]], 1_200_000)).toBe(true);
    expect(counted([[0, 500_000]], 1_200_000)).toBe(false);
  });
});
