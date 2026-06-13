/**
 * Coach v5.0 — Knowledge Base Loader
 *
 * Reads docs/COACH_KNOWLEDGE_BASE.md from disk at server-start and caches
 * it in memory. The full ~9k-token file is embedded in every Coach LLM
 * call so the model reasons from primary-source-verified principles
 * rather than its general training knowledge.
 *
 * Per the resolved cost design (COACH_PROMPT_DESIGN.md §7.2): full
 * Knowledge Base inline, no condensed reference. Effective communication
 * is the product; the tokens are the cost of producing it.
 *
 * Server-side only — this module imports `fs` and must never be bundled
 * into client code.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Read once at module-load time. In dev, hot-reload picks up changes
// when the file is edited; in production, the file is bundled at build.
const KB_PATH = join(process.cwd(), "docs", "COACH_KNOWLEDGE_BASE.md");

let cachedKnowledgeBase: string | null = null;

export function getKnowledgeBase(): string {
  if (cachedKnowledgeBase !== null) return cachedKnowledgeBase;
  try {
    cachedKnowledgeBase = readFileSync(KB_PATH, "utf-8");
    return cachedKnowledgeBase;
  } catch (err) {
    // If the file is missing in some deployment context, fall back to
    // an empty string with a console warning rather than crashing the
    // route. The Coach will still produce output but without the verified
    // principle library — degraded but not broken.
    console.error("[coach/v5] Failed to load Knowledge Base from", KB_PATH, err);
    cachedKnowledgeBase = "";
    return cachedKnowledgeBase;
  }
}
