import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SERVICE_PHILOSOPHY } from "../servicePhilosophy";
import { buildCareSystemPrompt } from "../prompt";
import {
  CO_PILOT_SYSTEM,
  FORMULATE_SYSTEM,
  SUMMARIZE_SYSTEM,
} from "../toolPrompts";

/**
 * The C.A.R.E service philosophy (2026-08-01 founder directive) must reach EVERY
 * reply-drafting surface so the system speaks with one service standard. This
 * test fails if a refactor drops it from any of the five, or accidentally puts
 * it on Summarize (a READ of the thread, not a customer reply — it must NOT
 * carry reply-shaping directives).
 */
const MARKER = "the only customer that matters"; // a distinctive line from SERVICE_PHILOSOPHY

describe("C.A.R.E service philosophy reaches every reply-drafting surface", () => {
  it("the constant itself carries the marker", () => {
    expect(SERVICE_PHILOSOPHY).toContain(MARKER);
  });

  it("the customer-facing auto-reply embeds it", () => {
    const prompt = buildCareSystemPrompt({ productContext: "Test product." });
    expect(prompt).toContain(MARKER);
  });

  it("the extension co-pilot + formulate embed it; summarize (a READ) does NOT", () => {
    expect(CO_PILOT_SYSTEM).toContain(MARKER);
    expect(FORMULATE_SYSTEM).toContain(MARKER);
    expect(SUMMARIZE_SYSTEM).not.toContain(MARKER);
  });

  it("the in-app co-pilot + formulate routes import + apply SERVICE_PHILOSOPHY", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const routes = [
      "../../../app/api/care/agent/conversations/[id]/co-pilot/route.ts",
      "../../../app/api/care/agent/conversations/[id]/formulate/route.ts",
    ];
    for (const rel of routes) {
      const src = readFileSync(join(here, rel), "utf8");
      expect(
        src.includes("SERVICE_PHILOSOPHY"),
        `${rel} must import SERVICE_PHILOSOPHY`
      ).toBe(true);
      expect(
        /\+\s*SERVICE_PHILOSOPHY/.test(src),
        `${rel} must apply it to the system prompt (found the import but no "+ SERVICE_PHILOSOPHY")`
      ).toBe(true);
    }
  });
});
