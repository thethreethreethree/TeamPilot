import { describe, it, expect } from "vitest";
import { sessionContextLines, DEFAULT_METHODOLOGY, reviewProductBlock } from "../prepShared";
import { buildSalesReviewSystemPrompt } from "../salesReviewPrompt";
import { buildSalesScoreSystemPrompt } from "../salesScorePrompt";
import type { SalesSession } from "@/lib/data/salesCoach";

/**
 * sessionContextLines is the ONE shared source (audit F3 / §A21) that both the pre-knock briefing and Prep-Time
 * Q&A use to turn a captured call into prompt lines — so a regression here silently degrades both engines. Pins
 * the field filtering (empty optionals dropped) and the in-person vs online phrasing.
 */

const session = (over: Partial<SalesSession> = {}): SalesSession =>
  ({ context: "video", ...over }) as SalesSession;

describe("sessionContextLines", () => {
  it("always includes the Context line and renders online vs in-person distinctly", () => {
    expect(sessionContextLines(session({ context: "video" })).join("\n")).toContain("online video call");
    expect(sessionContextLines(session({ context: "in_person" })).join("\n")).toContain("in-person, door-to-door");
  });

  it("includes each optional field only when present", () => {
    const lines = sessionContextLines(
      session({
        context: "in_person",
        clientLabel: "Acme spring campaign",
        territory: "North side",
        approach: "referral intro",
        offer: "annual plan",
      })
    );
    expect(lines).toEqual([
      "Client / campaign: Acme spring campaign",
      "Context: in-person, door-to-door",
      "Where: North side",
      "How approaching: referral intro",
      "Offer: annual plan",
    ]);
  });

  it("drops empty/missing optionals, leaving only the Context line", () => {
    expect(sessionContextLines(session({ context: "video", clientLabel: "", territory: undefined }))).toEqual([
      "Context: online video call",
    ]);
  });

  it("ships a non-empty default methodology for engines to reason from", () => {
    expect(DEFAULT_METHODOLOGY).toContain("DISCOVERY before pitch");
    expect(DEFAULT_METHODOLOGY.length).toBeGreaterThan(50);
  });
});

/**
 * reviewProductBlock (founder 2026-07-31 — product-aware post-call review) is the ONE shared block every review
 * engine injects. Pins: the real product text is embedded when set, and a no-invent instruction is present in
 * BOTH branches (so the coach never fabricates product specifics).
 */
describe("reviewProductBlock", () => {
  it("embeds the product text when set, with a no-invent guardrail", () => {
    const out = reviewProductBlock("SolarPro X — $99/mo, 25-year warranty");
    expect(out).toContain("SolarPro X — $99/mo, 25-year warranty");
    expect(out).toMatch(/NEVER invent product specifics/i);
  });

  it("tells the coach not to assume product specifics when none is on file", () => {
    for (const empty of [null, undefined, "", "   "]) {
      const out = reviewProductBlock(empty);
      expect(out).not.toMatch(/SolarPro/);
      expect(out).toMatch(/No product details on file/i);
      expect(out).toMatch(/do NOT invent/i);
    }
  });
});

/**
 * The "set but unsent" guard: prove the product param actually reaches the built system prompts (a fetch that
 * never lands in the prompt would be a silent no-op — the exact dead-wiring class). Two representative engines.
 */
describe("review system prompts embed the product block", () => {
  const PRODUCT = "Acme Roofing — lifetime labor warranty, financing from $0 down";
  it("salesReview injects the product details", () => {
    expect(buildSalesReviewSystemPrompt("methodology", undefined, PRODUCT)).toContain(PRODUCT);
  });
  it("salesScore injects the product details", () => {
    expect(buildSalesScoreSystemPrompt("methodology", PRODUCT)).toContain(PRODUCT);
  });
  it("omits a product block cleanly when none is provided", () => {
    expect(buildSalesScoreSystemPrompt("methodology")).toMatch(/No product details on file/i);
  });
});
