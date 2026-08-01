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

  // Content-integrity guard for the SAFETY-critical clauses. The marker above
  // only proves *a* line survived; these prove the load-bearing scoping did.
  // Without them a future edit could keep the marker but silently drop the
  // honesty-compatible recovery scoping — which is the whole reason the Schulz
  // "full amends" method is safe to inject into an AI that CANNOT grant refunds.
  it("keeps the service-recovery clause scoped to the honesty rules", () => {
    const p = SERVICE_PHILOSOPHY.toLowerCase();
    // No half-measure recovery (the Schulz "50% is not making amends" principle).
    expect(p).toContain("half-measure");
    // But the AI must hand off remedies it cannot grant, never promise them.
    expect(p).toContain("hand off");
    expect(p).toMatch(/never promise a remedy you can'?t deliver/);
    // And it must explicitly defer to the core honesty rules (never invent /
    // never claim human), so it shapes HOW to write, not WHETHER to be honest.
    expect(p).toContain("never invent facts");
    expect(p).toContain("never claim to be human");
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
