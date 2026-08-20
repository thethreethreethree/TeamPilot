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
