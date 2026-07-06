import { describe, expect, it } from "vitest";
import { buildLiveCueSystemPrompt } from "../liveCuePrompt";

/**
 * Cue grounding (founder 2026-07-06). A cue grounded in THIS company's
 * methodology + product is more helpful than generic advice — but the block is
 * optional and must fall back to the generic METHODOLOGY when absent (§3.4).
 */
describe("buildLiveCueSystemPrompt grounding", () => {
  it("stays generic (no company block) when no grounding is given", () => {
    const p = buildLiveCueSystemPrompt("suggestion");
    expect(p).not.toContain("THIS COMPANY");
    expect(p).toContain("SALES METHODOLOGY"); // generic block still present
  });

  it("injects the product and methodology when grounded", () => {
    const p = buildLiveCueSystemPrompt("suggestion", {
      product: "solar panel installation with a 25-year warranty",
      methodology: "lead with the energy-bill savings, then the warranty",
    });
    expect(p).toContain("THIS COMPANY");
    expect(p).toContain("What they sell: solar panel installation");
    expect(p).toContain("Their sales methodology: lead with the energy-bill");
  });

  it("injects only the field that is present", () => {
    const onlyProduct = buildLiveCueSystemPrompt("guide_response", {
      product: "widgets",
    });
    expect(onlyProduct).toContain("What they sell: widgets");
    expect(onlyProduct).not.toContain("Their sales methodology:");
  });

  it("falls back to generic when grounding is present but empty", () => {
    const p = buildLiveCueSystemPrompt("suggestion", { product: null, methodology: null });
    expect(p).not.toContain("THIS COMPANY");
  });
});
