import { describe, it, expect } from "vitest";
import { parseAssistantReply } from "../assistant";

/**
 * The assistant's deterministic parse. The LLM interprets; THIS turns its raw text into validated actions —
 * a malformed action is DROPPED (never a guessed write), a malformed reply degrades to a safe "rephrase"
 * message, and a pure question yields no actions. The route then evaluates + the manager confirms.
 */

describe("parseAssistantReply", () => {
  it("keeps a well-formed assign action", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "I'll put Darren on that shift.",
      actions: [{ op: "assign", employee: "Darren Guzman", date: "2026-08-25", start: "09:00", end: "17:00" }],
    }));
    expect(r.actions).toEqual([{ op: "assign", employee: "Darren Guzman", date: "2026-08-25", start: "09:00", end: "17:00" }]);
    expect(r.reply).toContain("Darren");
  });

  it("drops an assign missing/!invalid times (never a guessed write)", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "ok",
      actions: [
        { op: "assign", employee: "A", date: "2026-08-25", start: "9am", end: "17:00" }, // bad time
        { op: "assign", employee: "B", date: "not-a-date", start: "09:00", end: "17:00" }, // bad date
      ],
    }));
    expect(r.actions).toEqual([]);
  });

  it("parses unassign (optional times) and time_off (default day_off, endDate)", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "done",
      actions: [
        { op: "unassign", employee: "Marie", date: "2026-08-24" },
        { op: "time_off", employee: "Rebecca", date: "2026-08-22", endDate: "2026-08-23", type: "vacation" },
        { op: "time_off", employee: "Sam", date: "2026-08-22" }, // no type → day_off
      ],
    }));
    expect(r.actions[0]).toEqual({ op: "unassign", employee: "Marie", date: "2026-08-24" });
    expect(r.actions[1]).toEqual({ op: "time_off", employee: "Rebecca", date: "2026-08-22", endDate: "2026-08-23", type: "vacation" });
    expect(r.actions[2]).toMatchObject({ op: "time_off", employee: "Sam", type: "day_off" });
  });

  it("parses create_shift (default headcount 1) and cancel_shift (no employee needed)", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "ok",
      actions: [
        { op: "create_shift", date: "2026-08-25", start: "09:00", end: "17:00", headcount: 2, role: "nurse" },
        { op: "create_shift", date: "2026-08-26", start: "06:00", end: "15:00" }, // no headcount → 1
        { op: "cancel_shift", date: "2026-08-24", start: "22:00", end: "06:00" },
      ],
    }));
    expect(r.actions[0]).toEqual({ op: "create_shift", date: "2026-08-25", start: "09:00", end: "17:00", headcount: 2, role: "nurse" });
    expect(r.actions[1]).toMatchObject({ op: "create_shift", headcount: 1 });
    expect(r.actions[2]).toEqual({ op: "cancel_shift", date: "2026-08-24", start: "22:00", end: "06:00" });
  });

  it("parses retime_shift (all four times) and drops one missing a new time", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "ok",
      actions: [
        { op: "retime_shift", date: "2026-08-25", start: "09:00", end: "17:00", newStart: "10:00", newEnd: "18:00" },
        { op: "retime_shift", date: "2026-08-25", start: "09:00", end: "17:00", newStart: "10:00" }, // missing newEnd → dropped
      ],
    }));
    expect(r.actions).toEqual([{ op: "retime_shift", date: "2026-08-25", start: "09:00", end: "17:00", newStart: "10:00", newEnd: "18:00" }]);
  });

  it("drops an action with an IMPOSSIBLE calendar date (regex-shaped but not real)", () => {
    const r = parseAssistantReply(JSON.stringify({
      reply: "ok",
      actions: [
        { op: "create_shift", date: "2026-02-30", start: "09:00", end: "17:00" }, // Feb 30 → dropped
        { op: "cancel_shift", date: "2026-13-01" }, // month 13 → dropped
        { op: "create_shift", date: "2026-02-28", start: "09:00", end: "17:00" }, // real → kept
      ],
    }));
    expect(r.actions).toEqual([{ op: "create_shift", date: "2026-02-28", start: "09:00", end: "17:00", headcount: 1 }]);
  });

  it("a pure question yields a reply and no actions", () => {
    const r = parseAssistantReply(JSON.stringify({ reply: "Darren and Marie are working Thursday.", actions: [] }));
    expect(r.actions).toEqual([]);
    expect(r.reply).toContain("Thursday");
  });

  it("strips em/en dashes from the reply (voice rule)", () => {
    const r = parseAssistantReply(JSON.stringify({ reply: "Done — all set.", actions: [] }));
    expect(r.reply).not.toMatch(/[–—]/);
  });

  it("malformed JSON degrades to a safe rephrase message, no actions", () => {
    const r = parseAssistantReply("not json at all");
    expect(r.actions).toEqual([]);
    expect(r.reply.toLowerCase()).toContain("rephrasing");
  });
});
