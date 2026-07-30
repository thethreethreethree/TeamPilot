import { describe, expect, it } from "vitest";
import { ELOSTATE_PRODUCT_KNOWLEDGE } from "../elostateProductKnowledge";

/**
 * Content lock for the DEFINITIVE product knowledge Jeff answers from.
 *
 * WHY THIS EXISTS: Jeff was caught answering "what is C.A.R.E?" with "I'm not familiar
 * with that acronym in the context of Elostate" — on our OWN widget. A support AI that
 * can't define its own product is a launch-grade flaw (§3.4 — the whole product exists to
 * defeat confident well-formed failure). These assertions pin the non-negotiable facts so
 * a future edit can't silently drop the acronym expansion or a headline capability.
 *
 * This is NOT an exhaustive feature list (the file is the source of truth and grows every
 * release — founder mandate 2026-07-26). It locks the answers a prospect is most likely to
 * ask on first contact: what the two names mean, and that the flagship capabilities exist.
 */
describe("ELOSTATE_PRODUCT_KNOWLEDGE — the answers Jeff must never fail", () => {
  it("expands the C.A.R.E acronym (the exact question Jeff failed)", () => {
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toMatch(
      /Customer Assistance & Response Engine/i
    );
  });

  it("defines both product names so 'what is C.A.R.E / ELOSTATE?' is answerable", () => {
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toContain("C.A.R.E");
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toContain("ELOSTATE");
  });

  it("names the flagship capabilities a prospect asks about first", () => {
    // Each is a real, shipped feature. If one is renamed/removed, update BOTH the
    // knowledge and this lock in the same commit — that's the point of the test.
    for (const capability of [
      "Decision Dialogues",
      "Co-Pilot",
      "Ask Coach",
      "Adaptive Knowledge",
      "Coach Assessment",
      "Sales Coach",
      "Financial System",
      "Experience Mode",
      // Founder's two explicit 2026-07 requests — the extension and the conversation
      // capture that rides on it. Both are prospect-first questions ("can I use it on
      // WhatsApp/Gmail?", "can you pull conversations in?") and both were shipped this
      // cycle, so the mandate says lock them: a future edit must not silently drop the
      // RCD/extension answer and leave Jeff unable to describe a headline capability.
      "Browser extension",
      "Conversation Capture",
      // Shipped 2026-07-30 — the Sales Coach KPI Analytics system. A manager/rep asks "can it show me my
      // numbers / prove the coaching works?" — Jeff must be able to say yes and name Reliance Reduction.
      "KPI Analytics",
      "Reliance Reduction",
      // Shipped 2026-07-30 — the two founder-confirmed KPI additions. A manager asks "can I set a target /
      // will it warn me when a rep is slipping?" — Jeff must be able to say yes and describe both honestly
      // (quota stays "building" with no target; the alert is a check-in prompt vs the rep's own baseline).
      "Quota Attainment",
      "exception alert",
    ]) {
      expect(
        ELOSTATE_PRODUCT_KNOWLEDGE,
        `product knowledge must describe: ${capability}`
      ).toContain(capability);
    }
  });

  it("keeps the honesty posture (never guess, hand off when unsure) — §3.4", () => {
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toMatch(/hand off/i);
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toMatch(/honest/i);
  });

  it("instructs Jeff NOT to reflexively deny a real feature (the original bug class)", () => {
    expect(ELOSTATE_PRODUCT_KNOWLEDGE).toMatch(/never reflexively|never say you're unfamiliar/i);
  });
});
