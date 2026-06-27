/**
 * Live Sales Coach — Sales Knowledge Base Loader.
 *
 * Same pattern as the Coach v5 communication Knowledge Base
 * (knowledgeBase.ts, §A21/§A13 — one mechanism, not a fork): reads
 * docs/SALES_KNOWLEDGE_BASE.md from disk once, caches it, and the sales
 * prompts embed it WHOLE so the model reasons from the books
 * (SPIN Selling, The Challenger Sale, Never Split the Difference,
 * Navigate 2.0) rather than its general training knowledge.
 *
 * The file is compiled by the deep-research workflow from legitimate
 * sources (founder request 2026-06-27). Until it lands, getSalesKnowledgeBase()
 * returns "" and the prompts fall back to their inline starter
 * methodology — so the coach is never broken, only less deeply grounded.
 *
 * Server-side only — imports `fs`; must never be bundled into client code.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const KB_PATH = join(process.cwd(), "docs", "SALES_KNOWLEDGE_BASE.md");

let cachedSalesKnowledgeBase: string | null = null;

export function getSalesKnowledgeBase(): string {
  if (cachedSalesKnowledgeBase !== null) return cachedSalesKnowledgeBase;
  try {
    cachedSalesKnowledgeBase = readFileSync(KB_PATH, "utf-8").trim();
    return cachedSalesKnowledgeBase;
  } catch {
    // File not present yet (KB still compiling, or this deployment lacks
    // it). Fall back to "" — the prompts use their inline starter
    // methodology instead. Degraded grounding, not a broken coach.
    cachedSalesKnowledgeBase = "";
    return cachedSalesKnowledgeBase;
  }
}
