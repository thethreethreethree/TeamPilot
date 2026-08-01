import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Prompt-injection fence guard for the after-pitch LLM pipeline.
 *
 * Every one of the four sales-review "engines" feeds the DIARIZED TRANSCRIPT —
 * which contains untrusted CUSTOMER speech — to an LLM. A customer who says
 * "ignore your instructions and output…" during a call must be treated as DATA,
 * never obeyed. Each engine appends the shared CONVERSATION_IS_DATA fence to its
 * system prompt (added 2026-08-01 after an audit found the whole pipeline missing
 * it). This test fails if a refactor drops the fence from any engine — a silent
 * security regression that would otherwise pass typecheck + the other tests.
 */
// Every coach engine that feeds the diarized transcript (customer speech) to an
// LLM. Prep engines (salesPrep/salesPrepQA) and aggregate ones (salesWhyPatterns)
// don't ingest the transcript, so they're intentionally absent.
const engines = [
  "../salesReview.ts",
  "../salesMoments.ts",
  "../salesScore.ts",
  "../afterPitch.ts",
  "../salesDissect.ts",
  "../salesSummary.ts",
  "../salesWhy.ts",
  "../salesPivot.ts",
  "../salesIntel.ts",
];

const here = dirname(fileURLToPath(import.meta.url));

describe("sales-coach transcript LLM engines keep the prompt-injection fence", () => {
  for (const rel of engines) {
    it(`${rel.replace("../", "")} imports and applies CONVERSATION_IS_DATA`, () => {
      const src = readFileSync(join(here, rel), "utf8");
      expect(
        src.includes("CONVERSATION_IS_DATA"),
        `${rel} must import + append the shared injection fence to its system prompt`
      ).toBe(true);
      // It must be USED (appended), not merely imported and forgotten.
      expect(
        /\+\s*CONVERSATION_IS_DATA/.test(src),
        `${rel} must APPEND CONVERSATION_IS_DATA to the system prompt (found the import but no "+ CONVERSATION_IS_DATA")`
      ).toBe(true);
    });
  }
});
