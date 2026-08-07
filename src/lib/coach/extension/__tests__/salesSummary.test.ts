import { describe, it, expect } from "vitest";
import { salesSummarySystemPrompt } from "@/lib/coach/extension/salesSummary";

/**
 * The summary is prose-out (no JSON parse), so the testable contract is the prompt: it must frame the read
 * as sales deal-state, anchor the rep when known, forbid inventing a deal state, and always carry the
 * injection fence. The LLM call is not tested here (the route test covers the error mapping).
 */

describe("salesSummarySystemPrompt — sales framing + anchor + fence", () => {
  it("frames the summary as a sales deal-state read", () => {
    const p = salesSummarySystemPrompt();
    expect(p).toMatch(/where the deal stands/i);
    expect(p).toMatch(/objection or hesitation/i);
  });

  it("forbids inventing a deal state (honesty)", () => {
    expect(salesSummarySystemPrompt()).toMatch(/never invent a commitment/i);
  });

  it("names the rep as the WHO-IS-WHO anchor when provided", () => {
    expect(salesSummarySystemPrompt("Dana")).toContain("Dana is the SALES REP");
  });

  it("omits the anchor when no rep name is given", () => {
    expect(salesSummarySystemPrompt()).not.toContain("WHO IS WHO");
  });

  it("always carries the shared conversation-is-data injection fence", () => {
    expect(salesSummarySystemPrompt("Dana")).toContain("Untrusted input: the conversation");
    expect(salesSummarySystemPrompt()).toContain("Untrusted input: the conversation");
  });
});
