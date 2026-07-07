import { describe, expect, it } from "vitest";
import {
  parseConversationDissect,
  askCoachSystemPrompt,
  userHasSharedThinking,
  buildCoachUserMessage,
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

  it("drops an excerpt with a real prefix but a FABRICATED tail (§3.4 full-match)", () => {
    const out = parseConversationDissect(
      JSON.stringify({
        problem: { statement: "The deploy fails.", whyItMatters: "W" },
        evidence: [
          {
            observation: "prefix real, tail fabricated",
            excerpt:
              "The deploy keeps failing at the migration step because aliens hacked the server",
          },
        ],
      }),
      SOURCE
    );
    // The opening is a real quote but "because aliens hacked the server" is not in
    // the source — a prefix match would have let it through; full-match drops it.
    expect(out.evidence).toHaveLength(0);
  });

  it("keeps a real excerpt that differs only in whitespace", () => {
    const out = parseConversationDissect(
      JSON.stringify({
        problem: { statement: "The deploy fails.", whyItMatters: "W" },
        evidence: [
          { observation: "reformatted", excerpt: "The deploy   keeps\n failing" },
        ],
      }),
      SOURCE
    );
    expect(out.evidence).toHaveLength(1);
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

describe("userHasSharedThinking (§3.3 loop-fix regression lock)", () => {
  it("false on a fresh thread with no hypothesis (coach asks first)", () => {
    expect(userHasSharedThinking({ hypothesis: "", history: [] })).toBe(false);
    expect(userHasSharedThinking({ history: [] })).toBe(false);
  });

  it("true when the hypothesis box was filled", () => {
    expect(
      userHasSharedThinking({ hypothesis: "I think it's the creds", history: [] })
    ).toBe(true);
  });

  it("true once the user has spoken in the thread (the loop bug)", () => {
    // A user who answered the coach's opening question WITHOUT the box must not
    // be re-asked "what do you think?" forever.
    expect(
      userHasSharedThinking({
        history: [
          { role: "user", text: "how do I fix this?" },
          { role: "coach", text: "what do you think?" },
        ],
      })
    ).toBe(true);
  });

  it("false when only the coach has spoken (still awaiting the user)", () => {
    expect(
      userHasSharedThinking({ history: [{ role: "coach", text: "what do you think?" }] })
    ).toBe(false);
  });
});

describe("buildCoachUserMessage (coach memory assembly)", () => {
  it("includes the transcript when there is history (the coach's memory)", () => {
    const msg = buildCoachUserMessage({
      history: [
        { role: "user", text: "how do I fix this?" },
        { role: "coach", text: "what do you think?" },
      ],
      question: "I think it's the creds",
    });
    expect(msg).toContain("Conversation so far:");
    expect(msg).toContain("User: how do I fix this?");
    expect(msg).toContain("Coach: what do you think?");
    expect(msg).toContain("User's new message: I think it's the creds");
  });

  it("omits the transcript block on a fresh thread", () => {
    const msg = buildCoachUserMessage({ history: [], question: "where do I start?" });
    expect(msg).not.toContain("Conversation so far:");
    expect(msg).toContain("User's new message: where do I start?");
  });

  it("includes the user's stated thinking when present", () => {
    const msg = buildCoachUserMessage({
      history: [],
      hypothesis: "it's probably the migration order",
      question: "am I right?",
    });
    expect(msg).toContain("How the user is thinking about it: it's probably the migration order");
  });

  it("always ends with the new question", () => {
    const msg = buildCoachUserMessage({ history: [], question: "final q" });
    expect(msg.trim().endsWith("User's new message: final q")).toBe(true);
  });
});
