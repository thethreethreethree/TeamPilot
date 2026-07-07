import { describe, expect, it } from "vitest";
import {
  parseConversationDissect,
  askCoachSystemPrompt,
  EMPTY_DISSECT,
} from "../engine";

const SOURCE = `Alex: The deploy keeps failing at the migration step.
Sam: Did you check the DB creds? Last time it was a stale password.
Alex: I assumed the creds were fine since staging works.`;

describe("parseConversationDissect", () => {
  it("returns EMPTY on non-JSON", () => {
    expect(parseConversationDissect("not json", SOURCE)).toEqual(EMPTY_DISSECT);
  });

  it("returns EMPTY when hasSignal is explicitly false (§3.4 honest degrade)", () => {
    expect(
      parseConversationDissect(JSON.stringify({ hasSignal: false }), SOURCE)
    ).toEqual(EMPTY_DISSECT);
  });

  it("returns EMPTY when there is no problem statement (structural)", () => {
    const out = parseConversationDissect(
      JSON.stringify({ summary: "x", problem: { statement: "" } }),
      SOURCE
    );
    expect(out.hasSignal).toBe(false);
  });

  it("drops evidence whose excerpt is NOT in the source (§1.2/§3.4 no fabricated quotes)", () => {
    const out = parseConversationDissect(
      JSON.stringify({
        summary: "A failing deploy.",
        problem: { statement: "The deploy fails at migration.", whyItMatters: "Blocks release." },
        evidence: [
          { observation: "real", excerpt: "The deploy keeps failing at the migration step" },
          { observation: "hallucinated", excerpt: "Alex said the servers are on fire" },
        ],
        rootCause: "Assumed creds were fine.",
        anglesToConsider: [{ angle: "Check creds", why: "Prior failures were creds." }],
        guidingQuestion: "What would you verify first?",
      }),
      SOURCE
    );
    expect(out.hasSignal).toBe(true);
    expect(out.evidence).toHaveLength(1);
    expect(out.evidence[0]?.observation).toBe("real");
  });

  it("caps evidence at 5 and angles at 4", () => {
    const many = (n: number, f: (i: number) => unknown) =>
      Array.from({ length: n }, (_, i) => f(i));
    const out = parseConversationDissect(
      JSON.stringify({
        problem: { statement: "P", whyItMatters: "W" },
        // all excerpts are real substrings of SOURCE so they survive grounding
        evidence: many(8, () => ({ observation: "o", excerpt: "The deploy keeps failing" })),
        anglesToConsider: many(8, (i) => ({ angle: `a${i}`, why: "w" })),
      }),
      SOURCE
    );
    expect(out.evidence.length).toBeLessThanOrEqual(5);
    expect(out.anglesToConsider.length).toBeLessThanOrEqual(4);
  });
});

describe("askCoachSystemPrompt (§3.3 guide-don't-overtake)", () => {
  it("asks the user first when they have NOT shared their thinking", () => {
    const p = askCoachSystemPrompt({
      sourceText: SOURCE,
      problemStatement: "The deploy fails at migration.",
      userHasSharedTheirThinking: false,
    });
    expect(p).toMatch(/ask what they think the best path/i);
    expect(p).toMatch(/§3\.3/);
  });

  it("builds on the user's thinking when they HAVE shared it", () => {
    const p = askCoachSystemPrompt({
      sourceText: SOURCE,
      problemStatement: "The deploy fails at migration.",
      userHasSharedTheirThinking: true,
    });
    expect(p).toMatch(/Build on THEIR thinking/i);
  });

  it("embeds the pasted conversation for grounding (§3.4)", () => {
    const p = askCoachSystemPrompt({
      sourceText: SOURCE,
      problemStatement: null,
      userHasSharedTheirThinking: false,
    });
    expect(p).toContain("The deploy keeps failing at the migration step");
  });
});
