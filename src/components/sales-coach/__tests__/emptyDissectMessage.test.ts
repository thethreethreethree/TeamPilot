import { describe, it, expect } from "vitest";
import { emptyDissectMessage } from "../SessionCoachTools";

/**
 * The sentence shown when a dissect comes back with nothing.
 *
 * It used to read "Not enough of your side of the conversation to teach from yet." — the exact sentence
 * this project already withdrew from the mobile app, and it was still being said here, on the surface the
 * founder actually uses.
 *
 * It is false for most of these calls. Measured on production 2026-09-10: the sessions whose dissect comes
 * back empty are the LONGER ones — median 691 transcript words against 357 for the ones that succeed.
 * Thin content would be SHORT. Telling somebody their 691-word conversation was not enough of a
 * conversation is wrong, and it reads as a judgement of them rather than of the write-up that failed.
 *
 * Pinned, because a sentence that has been wrong once can be wrong again and nothing else would catch it.
 */
describe("emptyDissectMessage", () => {
  it("never tells a rep their conversation was too short", () => {
    for (const shape of [undefined, "llm_empty", "unparsable", "threw", "no_strengths", "no_agent_turns", "suppressed"]) {
      const m = emptyDissectMessage(shape);
      expect(m).not.toMatch(/not enough of your side/i);
      expect(m).not.toMatch(/not enough of a conversation/i);
    }
  });

  it("says the coach failed — not the call — when the coach failed", () => {
    for (const shape of ["llm_empty", "unparsable", "threw"]) {
      const m = emptyDissectMessage(shape);
      expect(m).toMatch(/recording is fine/i);
      expect(m).toMatch(/running it again/i);
    }
  });

  it("says it is about the conversation, not the person, when there was genuinely nothing to teach", () => {
    const m = emptyDissectMessage("no_strengths");
    expect(m).toMatch(/not about you/i);
    // And it must NOT offer the "run it again" hope — the coach read it through and found nothing.
    expect(m).not.toMatch(/again/i);
  });

  it("names a capture problem as a capture problem, with the way out", () => {
    const m = emptyDissectMessage("no_agent_turns");
    expect(m).toMatch(/not captured/i);
    expect(m).toMatch(/re-labelling/i);
  });

  it("an OLDER read carries no shape, and says only what is certainly true", () => {
    const m = emptyDissectMessage(undefined);
    expect(m).toMatch(/produced nothing/i);
    // No claim about WHY, because nothing recorded it.
    expect(m).not.toMatch(/recording is fine|not about you|not captured/i);
  });

  it("an unrecognised shape degrades to the same honest sentence rather than guessing", () => {
    expect(emptyDissectMessage("something_new_we_added_later")).toBe(emptyDissectMessage(undefined));
  });
});
