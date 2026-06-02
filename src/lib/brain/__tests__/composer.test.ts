import { describe, expect, it, vi } from "vitest";

// brain/index.ts imports these at module top — mock before importing the SUT.
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { composeSystemPrompt } from "../index";
import type {
  BrainRecord,
  BrainPattern,
  DisabledSuggestion,
  ValidatedMethod,
} from "../types";

function makeBrain(overrides: Partial<BrainRecord> = {}): BrainRecord {
  return {
    companyId: "co-1",
    version: 1,
    systemPromptAddendum: "",
    knownPatterns: [],
    styleCalibration: {},
    vocabulary: {},
    disabledSuggestions: [],
    validatedMethods: [],
    lastLearningAt: null,
    lastLearningSummary: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMethod(n: number): ValidatedMethod {
  return {
    method: `method-${n}`,
    why: `because-${n}`,
    source_resolution_ids: [`res-${n}`],
    learned_at: `2026-01-${String((n % 28) + 1).padStart(2, "0")}T00:00:00Z`,
  };
}
function makeDisabled(n: number): DisabledSuggestion {
  return {
    suggestion: `dont-${n}`,
    reason: `reason-${n}`,
    learned_at: `2026-01-${String((n % 28) + 1).padStart(2, "0")}T00:00:00Z`,
  };
}
function makePattern(n: number): BrainPattern {
  return {
    claim: `claim-${n}`,
    source_event_ids: [`evt-${n}`],
    confidence: "medium",
    derived_from: "held_resolution",
    learned_at: `2026-01-${String((n % 28) + 1).padStart(2, "0")}T00:00:00Z`,
  };
}

const DISCIPLINE_HEADER = "--- Discipline reminder ---";

describe("composeSystemPrompt", () => {
  it("empty brain produces base prompt plus discipline reminder, no other sections", () => {
    const out = composeSystemPrompt("BASE", makeBrain());
    expect(out.startsWith("BASE")).toBe(true);
    expect(out).toContain(DISCIPLINE_HEADER);
    expect(out).not.toContain("Per-company context");
    expect(out).not.toContain("Disabled suggestions");
    expect(out).not.toContain("Validated methods");
    expect(out).not.toContain("Known patterns");
  });

  it("includes a short addendum verbatim when under 4000 chars", () => {
    const addendum = "Speak plainly. Avoid jargon. Prefer concise bullets.";
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({ systemPromptAddendum: addendum })
    );
    expect(out).toContain(addendum);
    expect(out).not.toContain("[truncated]");
    expect(out).not.toContain("[earlier context truncated]");
  });

  it("truncates an addendum longer than 4000 chars", () => {
    // 5000 'a' chars — no paragraph break, forces hard slice w/ [truncated].
    const addendum = "a".repeat(5000);
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({ systemPromptAddendum: addendum })
    );
    const hasMarker =
      out.includes("[truncated]") || out.includes("[earlier context truncated]");
    expect(hasMarker).toBe(true);
    // The full 5000-char block must not appear verbatim.
    expect(out).not.toContain(addendum);
  });

  it("includes all validated methods when there are 20 or fewer; header reads 'showing N of N'", () => {
    const methods = Array.from({ length: 20 }, (_, i) => makeMethod(i + 1));
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({ validatedMethods: methods })
    );
    expect(out).toContain("showing 20 of 20");
    for (const m of methods) {
      expect(out).toContain(m.method);
    }
  });

  it("with more than 20 validated methods, only the 20 most recent are included and the header reads 'showing 20 of M'", () => {
    const methods = Array.from({ length: 25 }, (_, i) => makeMethod(i + 1));
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({ validatedMethods: methods })
    );
    expect(out).toContain("showing 20 of 25");
    // The 20 most recent are methods[5..24]; method-1 should be dropped.
    expect(out).not.toContain("method-1 ");
    expect(out).toContain("method-25");
    // Spot check that early ones are dropped.
    expect(out).not.toContain("- method-2 ");
    expect(out).not.toContain("- method-5 ");
    expect(out).toContain("- method-6 ");
  });

  it("applies the same 20-cap to disabledSuggestions and knownPatterns", () => {
    const disabled = Array.from({ length: 25 }, (_, i) => makeDisabled(i + 1));
    const patterns = Array.from({ length: 25 }, (_, i) => makePattern(i + 1));
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({
        disabledSuggestions: disabled,
        knownPatterns: patterns,
      })
    );
    expect(out).toContain("Disabled suggestions");
    expect(out).toContain("showing 20 of 25");
    // First five entries should be dropped from both lists.
    expect(out).not.toContain("dont-1 ");
    expect(out).toContain("dont-25");
    expect(out).not.toContain("claim-1 ");
    expect(out).toContain("claim-25");
  });

  it("places the discipline reminder as the last section", () => {
    const out = composeSystemPrompt(
      "BASE",
      makeBrain({
        systemPromptAddendum: "addendum text",
        validatedMethods: [makeMethod(1)],
        disabledSuggestions: [makeDisabled(1)],
        knownPatterns: [makePattern(1)],
      })
    );
    const idx = out.lastIndexOf(DISCIPLINE_HEADER);
    expect(idx).toBeGreaterThan(-1);
    // No other section header may appear after the discipline header.
    const tail = out.slice(idx);
    expect(tail).not.toContain("Per-company context");
    expect(tail).not.toContain("Disabled suggestions");
    expect(tail).not.toContain("Validated methods");
    expect(tail).not.toContain("Known patterns");
  });
});
