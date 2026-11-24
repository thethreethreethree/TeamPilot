import { describe, it, expect } from "vitest";
import {
  allManagerActions,
  coachingByRep,
  closesUnderEveryPolicy,
  countsAsFeedback,
  counted,
  gongRules,
  isRequestOpen,
  listenedSeconds,
  parseListenRange,
  requestAnsweredAt,
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

describe("loadCoachingEvents fails loud (INV22)", () => {
  it("a failed read throws FeedbackReadError — never an empty list that reads as 'no coaching happened'", async () => {
    const { loadCoachingEvents, FeedbackReadError } = await import("../feedback");
    const failing = {
      from: () => {
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in"]) q[m] = () => q;
        (q as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: null, error: { message: "boom" } }));
        return q;
      },
    };
    await expect(loadCoachingEvents(failing as never, "c1", ["s1"])).rejects.toBeInstanceOf(FeedbackReadError);
  });
});

describe("requestAnsweredAt — same test as isRequestOpen (§2.2)", () => {
  const req = { sessionId: "s1", managerId: null, requesterId: "rep", createdAt: new Date("2026-11-20T10:00:00Z") };
  const ev = (kind: "comment_sent_to_rep" | "comment_draft" | "own_session_action", at: string, managerId = "m1") =>
    ({ kind, managerId, repId: "rep", at: new Date(at), sessionId: "s1" }) as const;
  it("the earliest answering event after the ask; drafts, the rep's own actions and earlier events don't answer", () => {
    const events = [
      ev("comment_sent_to_rep", "2026-11-19T10:00:00Z"),
      ev("comment_draft", "2026-11-20T11:00:00Z"),
      ev("own_session_action", "2026-11-20T11:30:00Z", "rep"),
      ev("comment_sent_to_rep", "2026-11-22T10:00:00Z"),
      ev("comment_sent_to_rep", "2026-11-21T10:00:00Z"),
    ];
    expect(requestAnsweredAt(req, events)?.toISOString()).toBe("2026-11-21T10:00:00.000Z");
    expect(isRequestOpen(req, events)).toBe(false);
    const unanswered = events.slice(0, 3);
    expect(requestAnsweredAt(req, unanswered)).toBeNull();
    expect(isRequestOpen(req, unanswered)).toBe(true);
  });
});

describe("coachingByRep (F16.5) — one row per rep, same D8 rule", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);
  const rows = coachingByRep({
    reps: [{ id: "ana", name: "Ana" }, { id: "bo", name: "Bo" }, { id: "cy", name: "Cy" }],
    calls: [
      { id: "a1", repId: "ana", startedAt: d(3).toISOString() },
      { id: "a2", repId: "ana", startedAt: d(4).toISOString() },
      { id: "b1", repId: "bo", startedAt: d(2).toISOString() },
      { id: "b0", repId: "bo", startedAt: d(60).toISOString() },
    ],
    events: [
      { kind: "comment_sent_to_rep", managerId: "m", repId: "ana", at: d(1), sessionId: "a1" },
      { kind: "comment_draft", managerId: "m", repId: "bo", at: d(1), sessionId: "b1" }, // a draft is not feedback
      { kind: "score_override", managerId: "m", repId: "bo", at: d(45), sessionId: "b0" }, // old feedback
      { kind: "own_session_action", managerId: "bo", repId: "bo", at: d(1), sessionId: "b1" }, // acting on your own call
    ],
    requests: [
      { sessionId: "b1", managerId: null, requesterId: "bo", createdAt: d(2) },
      { sessionId: "a1", managerId: null, requesterId: "ana", createdAt: d(2) }, // answered by the comment on day 1
    ],
    now,
  });
  const by = (id: string) => rows.find((r) => r.repId === id)!;

  it("counts feedback the D8 way, and which calls nobody coached", () => {
    expect(by("ana")).toMatchObject({ feedback30: 1, overdue: false, calls30: 2, callsWithoutFeedback30: 1, openRequests: 0 });
    expect(by("ana").lastFeedbackAt).toBe(d(1).toISOString());
    expect(by("ana").uncoached.map((c) => c.id)).toEqual(["a2"]); // F16.6: the call nobody coached
  });
  it("overdue = calls in 30 days and no feedback in 30 days; an old correction is the last feedback, a draft is not", () => {
    expect(by("bo")).toMatchObject({ feedback30: 0, overdue: true, calls30: 1, callsWithoutFeedback30: 1, openRequests: 1 });
    expect(by("bo").lastFeedbackAt).toBe(d(45).toISOString());
  });
  it("a rep with no calls is not overdue", () => {
    expect(by("cy")).toMatchObject({ overdue: false, calls30: 0, lastFeedbackAt: null });
  });
  it("overdue first, then least feedback, then name", () => {
    expect(rows.map((r) => r.repId)).toEqual(["bo", "cy", "ana"]);
  });
});

describe("loadCoachingEvents — a removed comment is not feedback (0333; review 2026-11-25)", () => {
  it("leaves out a comment whose latest revision removed it; keeps an edited one", async () => {
    const { loadCoachingEvents } = await import("../feedback");
    const DATA: Record<string, unknown[]> = {
      pitch_scores: [{ id: "p1", session_id: "s1", rep_id: "rep" }],
      recording_comments: [
        { id: "c-removed", pitch_id: "p1", author_id: "m1", sent_to_rep: true, created_at: "2026-11-20T10:00:00Z" },
        { id: "c-edited", pitch_id: "p1", author_id: "m1", sent_to_rep: true, created_at: "2026-11-21T10:00:00Z" },
      ],
      recording_comment_revisions: [
        { id: 1, comment_id: "c-removed", removed: true },
        { id: 2, comment_id: "c-edited", removed: false },
      ],
    };
    const db = {
      from: (t: string) => {
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in"]) q[m] = () => q;
        (q as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: DATA[t] ?? [], error: null }));
        return q;
      },
    };
    const events = await loadCoachingEvents(db as never, "c1", ["s1"]);
    const comments = events.filter((e) => e.kind === "comment_sent_to_rep");
    expect(comments.map((e) => e.at.toISOString())).toEqual(["2026-11-21T10:00:00.000Z"]);
  });
});
