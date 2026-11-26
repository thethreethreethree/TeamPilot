import { describe, it, expect } from "vitest";
import { NOT_DISCUSSED, parseAnswers, parseSections, questionsBlock } from "../briefTemplates";

/** F13.2 (2026-11-26): brief templates — checked questions; answers must rest on real lines or say "not discussed". */
const lines = [
  { seq: 1, speaker: "customer", text: "Our budget is about ten thousand." },
  { seq: 2, speaker: "rep", text: "Who else signs off?" },
  { seq: 3, speaker: "customer", text: "My CFO." },
] as never;
const sections = [
  { question: "What budget did they mention?", instructions: "" },
  { question: "Who else decides?", instructions: "Name roles, not people." },
  { question: "When do they want to start?", instructions: "" },
];

describe("brief templates", () => {
  it("questions are checked", () => {
    expect(parseSections([])).toEqual({ ok: false, error: "Add at least one question." });
    expect(parseSections(Array.from({ length: 9 }, () => ({ question: "q" }))).ok).toBe(false);
    expect(parseSections([{ question: "  " }])).toEqual({ ok: false, error: "Question 1 needs to be 1–200 characters." });
    expect(parseSections([{ question: " Budget? ", instructions: " short " }])).toEqual({ ok: true, sections: [{ question: "Budget?", instructions: "short" }] });
    expect(questionsBlock(sections)).toContain("2. Who else decides?\n   Instructions: Name roles, not people.");
  });
  it("an answer stands only on lines that exist; unanswered or uncited is 'not discussed'", () => {
    const raw = JSON.stringify({ answers: [
      { n: 1, answer: "About ten thousand.", seq: [1, 99] },
      { n: 2, answer: "The CFO.", seq: [] }, // no line → not an answer
      { n: 3, answer: "Next month.", seq: [42] }, // a line that doesn't exist
    ] });
    expect(parseAnswers(raw, sections, lines)).toEqual([
      { question: "What budget did they mention?", answer: "About ten thousand.", seqs: [1] },
      { question: "Who else decides?", answer: NOT_DISCUSSED, seqs: [] },
      { question: "When do they want to start?", answer: NOT_DISCUSSED, seqs: [] },
    ]);
    expect(parseAnswers("not json", sections, lines).every((a) => a.answer === NOT_DISCUSSED)).toBe(true);
  });
});
