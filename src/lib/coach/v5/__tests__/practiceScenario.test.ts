import { describe, it, expect } from "vitest";
import {
  parsePracticeScenario,
  buildPitchReplaySystemPrompt,
  buildPitchReplayUserMessage,
} from "../practiceScenario";

/**
 * parsePracticeScenario is the honesty seam for AI-written practice scenarios (§3.4): a malformed/empty generation
 * returns null so the caller falls back to the plain focus seed — never a fabricated or blank scenario.
 */
describe("parsePracticeScenario", () => {
  it("parses a valid scenario", () => {
    const s = parsePracticeScenario(
      JSON.stringify({ title: "The burned homeowner", persona: "Guarded homeowner, just home from work", situation: "They had a bad experience with a competitor last year and are short on time." }),
    );
    expect(s?.title).toBe("The burned homeowner");
    expect(s?.persona).toContain("Guarded homeowner");
    expect(s?.situation).toContain("bad experience");
  });

  it("tolerates a ```json fence", () => {
    const s = parsePracticeScenario("```json\n" + JSON.stringify({ title: "T", persona: "P", situation: "S" }) + "\n```");
    expect(s?.persona).toBe("P");
  });

  it("returns null on malformed / non-object JSON (fall back to the plain seed)", () => {
    expect(parsePracticeScenario("not json")).toBeNull();
    expect(parsePracticeScenario("")).toBeNull();
    expect(parsePracticeScenario("null")).toBeNull();
    expect(parsePracticeScenario("[1,2]")).toBeNull();
  });

  it("returns null when there is neither a persona nor a situation (nothing usable)", () => {
    expect(parsePracticeScenario(JSON.stringify({ title: "Just a title" }))).toBeNull();
  });

  it("keeps a scenario with only a situation (a missing title/persona is not fatal)", () => {
    const s = parsePracticeScenario(JSON.stringify({ situation: "A homeowner mid-argument with a spouse answers the door." }));
    expect(s).not.toBeNull();
    expect(s?.situation).toContain("homeowner");
    expect(s?.title).toBe("");
  });
});

describe("pitch-replay prompt (reconstruct the customer from a recorded pitch)", () => {
  it("system prompt enforces faithfulness + no-coaching + non-diarized inference (§3.4)", () => {
    const sys = buildPitchReplaySystemPrompt();
    // It must key the reconstruction on what the CUSTOMER actually said, not invent objections.
    expect(sys).toMatch(/customer/i);
    expect(sys).toMatch(/do NOT invent|actually said/i);
    // It must not let the prospect break character (no naming the skill / "this is practice").
    expect(sys).toMatch(/NEVER name a skill|this is a practice/i);
    // It must tell the model the transcript is unlabeled and to infer speakers (the non-diarized reality).
    expect(sys).toMatch(/not labeled|infer which lines/i);
    // Returns the same PracticeScenario JSON shape the client already seeds from.
    expect(sys).toContain('"persona"');
    expect(sys).toContain('"situation"');
  });

  it("user message embeds the transcript + outcome and clamps very long transcripts", () => {
    const long = "objection ".repeat(2000); // ~18k chars
    const msg = buildPitchReplayUserMessage(long, "not_interested");
    expect(msg).toContain("not_interested");
    expect(msg).toContain("objection");
    // Clamped to keep the token budget bounded — the whole 18k blob is NOT passed through.
    expect(msg.length).toBeLessThan(7000);
  });

  it("user message omits the outcome line when no outcome is given", () => {
    const msg = buildPitchReplayUserMessage("Rep pitched solar; customer said too expensive.");
    expect(msg).toContain("too expensive");
    expect(msg).not.toMatch(/How the real call ended/);
  });
});
