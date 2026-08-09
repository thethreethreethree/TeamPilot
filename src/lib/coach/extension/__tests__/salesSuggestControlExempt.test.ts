import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Day-1 exemption guard (review Finding, Area 3 — a real pre-existing bug the founder confirmed: "extension
 * works from day 1"). Every OTHER Sales Coach surface sets controlExempt:true; the extension's Suggested
 * Response engines did not, so a customer in their §3.4 month-1 control window got an empty 502 instead of a
 * draft. These lock that BOTH engines now pass controlExempt:true to the LLM helper. Detection-true: fails if
 * the flag is dropped from either engine.
 */

vi.mock("@/lib/claude", () => ({
  generateCareReply: vi.fn(async () => ({ text: "Sounds great.\n===REASONING===\nwarm close" })),
}));

import { generateCareReply } from "@/lib/claude";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";

beforeEach(() => vi.clearAllMocks());

describe("Sales Coach Suggested Response — runs day-1 (controlExempt)", () => {
  it("co-pilot engine passes controlExempt:true (not gated by the month-1 control window)", async () => {
    await generateSalesCopilotReply({ companyId: "c1", conversation: "prospect: interested" });
    expect(vi.mocked(generateCareReply).mock.calls[0]?.[0]?.controlExempt).toBe(true);
  });

  it("formulate engine passes controlExempt:true", async () => {
    await generateSalesFormulate({ companyId: "c1", conversation: "prospect: interested", intent: "acknowledge" });
    expect(vi.mocked(generateCareReply).mock.calls[0]?.[0]?.controlExempt).toBe(true);
  });
});
