import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSalesReviewSystemPrompt } from "../salesReviewPrompt";
import { buildSalesScoreSystemPrompt } from "../salesScorePrompt";
import { buildSalesDissectSystemPrompt } from "../salesDissectPrompt";
import { buildSalesMomentsSystemPrompt } from "../salesMomentsPrompt";
import { buildSalesPivotSystemPrompt } from "../salesPivotPrompt";

/**
 * Prompt-layer guard for the no-minimum-length build (founder 2026-08-05).
 *
 * The founder's bug lived in the PROMPTS: each content engine's system prompt told the model to
 * "return hasSignal:false if the transcript is too thin", so a real short pitch was refused. The build
 * flipped every prompt to pin `"hasSignal": true`. The generate-path guards MOCK the LLM, so they cannot
 * catch a prompt regression that re-adds the refusal — this does, at the prompt level: each built prompt
 * must pin `"hasSignal": true` in its output shape and must NOT offer a `false`/`boolean` hasSignal (the
 * refusal). salesWhy's prompt is inline (not an exported builder), so its output block is checked as text
 * — scoped to the OUTPUT JSON so the engine's own `o.hasSignal === false` parse logic is not matched.
 */
const BUILT: Record<string, string> = {
  salesReview: buildSalesReviewSystemPrompt(),
  salesScore: buildSalesScoreSystemPrompt(),
  salesDissect: buildSalesDissectSystemPrompt(),
  salesMoments: buildSalesMomentsSystemPrompt(),
  salesPivot: buildSalesPivotSystemPrompt(),
};

describe("sales-coach prompts pin hasSignal:true (no-minimum-length: never re-add the refusal)", () => {
  for (const [name, prompt] of Object.entries(BUILT)) {
    it(`${name} — output shape pins "hasSignal": true`, () => {
      expect(prompt).toMatch(/"hasSignal":\s*true/);
    });
    it(`${name} — never offers a false/boolean hasSignal (the refusal)`, () => {
      expect(prompt).not.toMatch(/"hasSignal":\s*(false|boolean)/);
    });
  }

  it("salesWhy (inline prompt) — its OUTPUT block pins hasSignal:true, not false/boolean", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "../salesWhy.ts"), "utf8");
    // The OUTPUT JSON block: from "OUTPUT" to the primaryDriver line — scoped to avoid the parse logic.
    const outBlock = src.match(/OUTPUT[\s\S]*?"primaryDriver"/)?.[0] ?? "";
    expect(outBlock).toMatch(/"hasSignal":\s*true/);
    expect(outBlock).not.toMatch(/"hasSignal":\s*(false|boolean)/);
  });
});
