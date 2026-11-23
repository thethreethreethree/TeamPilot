import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/claude", () => ({ callBriefCoach: vi.fn(), followThroughCoach: vi.fn() }));

import { parseCallBrief } from "../callBrief";
import { clampOffset, dayBounds, eventValue, prevDay, parseDayPlan, parseFollowUp, pipelineTotals, stepsToCompleted, summariseYesterday } from "../macroMode";
import { TASK_STATUS_TRANSITIONS } from "@/lib/tasks/statusLabels";

/**
 * Remote Sales Macro Mode (docs/rss/MACRO-MODE-SPEC.md, 0303). Each test is a way the simplified system could say
 * something untrue while looking finished: an invented key point, a to-do the rep never wrote, a "[Name]" sent to a
 * prospect, a pipeline total that counts a lost deal as open, a "Done" the Tasks module would refuse.
 */
const lines = [
  { seq: 1, speaker: "rep", text: "Thanks for taking the call", atMs: 0 },
  { seq: 2, speaker: "customer", text: "We need it live before March", atMs: 4000 },
  { seq: 3, speaker: "rep", text: "I'll send the quote Thursday", atMs: 9000 },
];
const CALL = new Date("2026-11-20T15:00:00Z");

describe("parseCallBrief — nothing on the page that the call did not say", () => {
  it("keeps items that cite a real line and drops the ones that don't", () => {
    const b = parseCallBrief(
      JSON.stringify({
        key_points: [{ text: "Needs it live before March", seq: 2 }, { text: "Has budget approval", seq: 99 }],
        next_steps: [{ text: "Rep sends the quote Thursday", seq: 3 }, { text: "No line", seq: "x" }],
        next_meeting: { agenda: [{ text: "Walk through the quote" }, ""], bring_up: [{ text: "March deadline", seq: 2 }, { text: "Invented", seq: 7 }], checklist: [] },
      }),
      lines,
      CALL,
    );
    expect(b.keyPoints).toEqual([{ text: "Needs it live before March", seq: 2 }]);
    expect(b.nextSteps).toEqual([{ text: "Rep sends the quote Thursday", seq: 3 }]);
    expect(b.nextMeeting.bringUp).toEqual([{ text: "March deadline", seq: 2 }]);
    expect(b.nextMeeting.agenda).toEqual([{ text: "Walk through the quote" }]);
  });

  it("keeps a checklist due date only between the call and 180 days after it", () => {
    const b = parseCallBrief(
      JSON.stringify({ next_meeting: { checklist: [{ text: "Send quote", due: "2026-11-26" }, { text: "Old", due: "2025-01-01" }, { text: "Far", due: "2027-12-01" }, { text: "Vague", due: "soon" }] } }),
      lines,
      CALL,
    );
    expect(b.nextMeeting.checklist.map((c) => c.due)).toEqual(["2026-11-26", null, null, null]);
  });

  it("caps every list and survives a fenced or broken reply", () => {
    const many = Array.from({ length: 20 }, () => ({ text: "x", seq: 1 }));
    const b = parseCallBrief("```json\n" + JSON.stringify({ key_points: many, next_steps: many }) + "\n```", lines, CALL);
    expect(b.keyPoints).toHaveLength(6);
    expect(b.nextSteps).toHaveLength(5);
    expect(parseCallBrief("not json", lines, CALL).keyPoints).toEqual([]);
  });
});

describe("parseDayPlan — organise the rep's day, never add to it", () => {
  const dump = "Call John at 9, follow up with Michelle, team meeting at 11. Needle movers: close Michelle, book John.";
  it("drops an item that shares no word with what the rep wrote, sorts by time", () => {
    const p = parseDayPlan(
      JSON.stringify({
        items: [
          { time: "11:00", what: "Team meeting" },
          { time: "09:00", what: "Call John" },
          { time: null, what: "Follow up with Michelle" },
          { time: "14:00", what: "Prospect webinar recording" },
        ],
        needle_movers: ["Follow up with Michelle", "Call John", "Prospect webinar recording"],
      }),
      dump,
    )!;
    expect(p.items.map((i) => i.what)).toEqual(["Call John", "Team meeting", "Follow up with Michelle"]);
    expect(p.needleMovers).toEqual(["Follow up with Michelle", "Call John"]);
  });
  it("refuses a malformed time and returns null for an unreadable reply", () => {
    const p = parseDayPlan(JSON.stringify({ items: [{ time: "9am", what: "Call John" }] }), dump)!;
    expect(p.items[0]!.time).toBeNull();
    expect(parseDayPlan("nope", dump)).toBeNull();
  });
});

describe("parseFollowUp", () => {
  it("refuses a draft with a template slot rather than hand the rep a guessed fact", () => {
    expect(parseFollowUp(JSON.stringify({ subject: "Hi", body: "Hi [Name], great talking." }), "email")).toBeNull();
  });
  it("a text has no subject and stays short", () => {
    const d = parseFollowUp(JSON.stringify({ subject: "x", body: "a".repeat(900) }), "text")!;
    expect(d.subject).toBeNull();
    expect(d.body.length).toBe(480);
  });
});

describe("pipelineTotals — Open / Closed Won / Closed Lost", () => {
  it("adds each prospect to its own tab and skips a missing amount", () => {
    const t = pipelineTotals([
      { status: "open", amount: 1500 },
      { status: "open", amount: null },
      { status: "won", amount: "2000" },
      { status: "lost", amount: 300 },
      { status: "weird", amount: 10 },
    ]);
    expect(t.open).toEqual({ count: 3, amount: 1510 });
    expect(t.won).toEqual({ count: 1, amount: 2000 });
    expect(t.lost).toEqual({ count: 1, amount: 300 });
  });
});

describe("summariseYesterday — counted, never written", () => {
  it("counts calls and outcomes and averages only real scores", () => {
    expect(summariseYesterday([{ outcome: "sold" }, { outcome: null }, { outcome: "sold" }], [{ total: 80 }, { total: null }, { total: 91 }])).toEqual({
      calls: 3,
      scored: 2,
      averageScore: 85.5,
      outcomes: { sold: 2 },
    });
  });
});

describe("eventValue — the shapes 0303's CHECKs accept", () => {
  it("stage must be open/won/lost; amount a non-negative number; next call a date or cleared", () => {
    expect(eventValue("stage", { status: "won", label: " Signed " })).toEqual({ status: "won", label: "Signed" });
    expect(eventValue("stage", { status: "maybe" })).toBeNull();
    expect(eventValue("amount", -1)).toBeNull();
    expect(eventValue("amount", 1200)).toEqual({ amount: 1200 });
    expect(eventValue("next_call", null)).toEqual({ date: null });
    expect(eventValue("next_call", "tomorrow")).toBeNull();
    expect(eventValue("close_date", "2026-12-31")).toEqual({ date: "2026-12-31" }); // 0320
    expect(eventValue("close_date", null)).toEqual({ date: null });
    expect(eventValue("close_date", "end of Q4")).toBeNull();
    // 0325: a next call may carry a local time; a close date never does
    expect(eventValue("next_call", { date: "2026-12-01", time: "15:30" })).toEqual({ date: "2026-12-01", time: "15:30" });
    expect(eventValue("next_call", { date: "2026-12-01", time: "" })).toEqual({ date: "2026-12-01" });
    expect(eventValue("next_call", { date: "2026-12-01", time: "3pm" })).toBeNull();
    expect(eventValue("close_date", { date: "2026-12-01", time: "15:30" })).toBeNull();
    expect(eventValue("name", "  ")).toBeNull();
  });
});

describe("stepsToCompleted — 'Done' walks the Tasks module's own graph", () => {
  it("To Do cannot jump to Completed; it goes through In Progress", () => {
    expect(stepsToCompleted("To Do", TASK_STATUS_TRANSITIONS)).toEqual(["In Progress", "Completed"]);
    expect(stepsToCompleted("In Progress", TASK_STATUS_TRANSITIONS)).toEqual(["Completed"]);
    expect(stepsToCompleted("Blocked", TASK_STATUS_TRANSITIONS)).toEqual(["In Progress", "Completed"]);
    expect(stepsToCompleted("Completed", TASK_STATUS_TRANSITIONS)).toEqual([]);
    expect(stepsToCompleted("Unknown", TASK_STATUS_TRANSITIONS)).toEqual([]);
  });
});

describe("the rep's calendar day (Today, 2026-11-23)", () => {
  it("Manila (offset −480): 23 Nov runs 22 Nov 16:00Z → 23 Nov 16:00Z", () => {
    expect(dayBounds("2026-11-23", -480)).toEqual(["2026-11-22T16:00:00.000Z", "2026-11-23T16:00:00.000Z"]);
  });
  it("Los Angeles (offset +480): 23 Nov runs 23 Nov 08:00Z → 24 Nov 08:00Z", () => {
    expect(dayBounds("2026-11-23", 480)).toEqual(["2026-11-23T08:00:00.000Z", "2026-11-24T08:00:00.000Z"]);
  });
  it("yesterday crosses month and year ends", () => {
    expect(prevDay("2026-12-01")).toBe("2026-11-30");
    expect(prevDay("2027-01-01")).toBe("2026-12-31");
    expect(prevDay("2028-03-01")).toBe("2028-02-29");
  });
  it("an offset outside ±14 h, or not a whole number, is UTC", () => {
    expect(clampOffset("-480")).toBe(-480);
    expect(clampOffset("840")).toBe(840);
    for (const bad of ["9999", "-900", "2.5", "abc", null, ""]) expect(clampOffset(bad)).toBe(0);
  });
});
