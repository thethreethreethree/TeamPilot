import { describe, it, expect } from "vitest";
import { allowed, NOT_FOUND, parseElements, parseReview, PLAYBOOKS, replayNotes, reviewPrompt, type CallLines, type NoteEvent } from "../playbook";

/** Playbooks and the AI Deal Reviewer (0373; Gong F20.6, F20.7): allowed and refused pairs. */
describe("note states", () => {
  it("a person writes before anyone validates; an AI read never overwrites a note; editing un-validates", () => {
    expect(allowed("empty", "validate")).toBe(false);
    expect(allowed("ai_found", "validate")).toBe(false);
    expect(allowed("noted", "validate")).toBe(true);
    const ev = (action: NoteEvent["action"], extra: Partial<NoteEvent> = {}): NoteEvent => ({ element: 0, action, note: null, ai: null, actorId: "u", at: "2026-11-27", ...extra });
    const v = replayNotes([
      ev("ai_suggest", { ai: { answer: "Budget is 10k", cites: [{ sessionId: "s", seq: 1 }] } }),
      ev("validate"), // ignored: nothing written yet
      ev("write", { note: "Budget 10k, approved by CFO" }),
      ev("validate", { actorId: "mgr" }),
      ev("ai_suggest", { ai: { answer: "newer read", cites: [] } }),
    ], 1)[0]!;
    expect(v.state).toBe("validated");
    expect(v.note).toBe("Budget 10k, approved by CFO");
    expect(v.validatedBy).toBe("mgr");
    expect(v.ai?.answer).toBe("newer read");
    const edited = replayNotes([ev("write", { note: "a" }), ev("validate"), ev("write", { note: "b" })], 1)[0]!;
    expect(edited).toMatchObject({ state: "noted", note: "b", validatedBy: null });
    expect(replayNotes([ev("write", { note: "a" }), ev("clear")], 1)[0]).toMatchObject({ state: "empty", note: null });
  });
  it("an event for an element that doesn't exist is ignored", () => {
    expect(replayNotes([{ element: 5, action: "write", note: "x", ai: null, actorId: "u", at: "t" }], 2).every((v) => v.state === "empty")).toBe(true);
  });
});

describe("custom playbooks", () => {
  it("checks labels, names and questions", () => {
    expect(parseElements([])).toEqual({ ok: false, error: "Add at least one element." });
    expect(parseElements([{ letter: "toolong", name: "X", question: "Q?" }]).ok).toBe(false);
    expect(parseElements([{ letter: "r", name: " Risk ", question: " What could stop it? " }])).toEqual({ ok: true, elements: [{ letter: "R", name: "Risk", question: "What could stop it?" }] });
  });
  it("the built-ins have their letters in order", () => {
    expect(PLAYBOOKS.meddicc.elements.map((e) => e.letter).join("")).toBe("MEDDICC");
    expect(PLAYBOOKS.bant.elements.map((e) => e.letter).join("")).toBe("BANT");
    expect(PLAYBOOKS.spiced.elements.map((e) => e.letter).join("")).toBe("SPICED");
  });
});

describe("the reviewer", () => {
  const calls: CallLines[] = [
    { sessionId: "s2", startedAt: "2026-11-20T10:00:00Z", lines: [{ seq: 1, speaker: "customer", text: "Our budget is ten thousand.", atMs: 5000 }] },
    { sessionId: "s1", startedAt: "2026-11-10T10:00:00Z", lines: [{ seq: 4, speaker: "customer", text: "My CFO signs.", atMs: 9000 }] },
  ];
  const els = PLAYBOOKS.bant.elements;
  it("the prompt numbers calls C1, C2 newest first", () => {
    expect(reviewPrompt(els, calls, (l) => l.map((x) => `[${x.seq}] ${x.text}`).join("\n"))).toContain("=== C1 · call on 2026-11-20 ===\n[1] Our budget is ten thousand.");
  });
  it("evidence stands only on lines that exist on those calls; uncited is 'not found'", () => {
    const raw = JSON.stringify({ elements: [
      { n: 1, answer: "Budget about 10k.", cites: [{ call: "C1", seq: 1 }, { call: 1, seq: 99 }] },
      { n: 2, answer: "The CFO signs.", cites: [{ call: 2, seq: 4 }] },
      { n: 3, answer: "They need it.", cites: [] },
      { n: 4, answer: "Next month.", cites: [{ call: 3, seq: 1 }] },
    ] });
    expect(parseReview(raw, els, calls)).toEqual([
      { answer: "Budget about 10k.", cites: [{ sessionId: "s2", seq: 1, atMs: 5000 }] },
      { answer: "The CFO signs.", cites: [{ sessionId: "s1", seq: 4, atMs: 9000 }] },
      { answer: NOT_FOUND, cites: [] },
      { answer: NOT_FOUND, cites: [] },
    ]);
  });
  it("a cut-off or empty reply is a failed read, not 'nothing found'", () => {
    expect(parseReview("not json", els, calls)).toBeNull();
    expect(parseReview('{"elements": [{"n": 1, "answer": "Bud', els, calls)).toBeNull();
    expect(parseReview('{"elements": []}', els, calls)).toBeNull();
  });
});
