import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verifies generateCareReply FORWARDS experienceMode down the chain (0110 Phase
 * 2) — the middle of route → generateCareReply → call → runBrainCall/llmCall.
 * The endpoints are tested elsewhere (route handler, llmCall injection); this
 * pins the pass-through, including the §A17 behavior that a caller which passes
 * NO mode (the customer-facing co-pilot) forwards `undefined` = full quality.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brain", () => ({
  runBrainCall: vi.fn(async () => ({
    text: "reply",
    model: "m",
    provider: "p",
    gate: { guidanceEnabled: true },
    brainVersion: 1,
  })),
}));
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn(async () => ({ text: "reply", model: "m", provider: "p" })),
}));

import { runBrainCall } from "@/lib/brain";
import { llmCall } from "@/lib/llm";
import { generateCareReply } from "../claude";

const brain = vi.mocked(runBrainCall);
const direct = vi.mocked(llmCall);

beforeEach(() => {
  brain.mockClear();
  direct.mockClear();
});

describe("generateCareReply forwards experienceMode (§A16/§A17 plumbing)", () => {
  it("forwards the mode to runBrainCall on the brain path (companyId set)", async () => {
    await generateCareReply({
      companyId: "c1",
      systemPrompt: "S",
      userMessage: "U",
      experienceMode: "standard",
    });
    expect(brain).toHaveBeenCalledOnce();
    expect(brain.mock.calls[0]![0].experienceMode).toBe("standard");
  });

  it("forwards the mode to llmCall on the direct path (no companyId)", async () => {
    await generateCareReply({
      systemPrompt: "S",
      userMessage: "U",
      experienceMode: "standard",
    });
    expect(direct).toHaveBeenCalledOnce();
    expect(
      (direct.mock.calls[0]![0] as { experienceMode?: string }).experienceMode
    ).toBe("standard");
  });

  it("forwards UNDEFINED when the caller passes no mode — the customer-facing default stays full (§A17)", async () => {
    // This is the co-pilot / formulate / auto-reply pattern: no experienceMode,
    // so a customer never gets terser support because their agent picked Standard.
    await generateCareReply({ companyId: "c1", systemPrompt: "S", userMessage: "U" });
    expect(brain.mock.calls[0]![0].experienceMode).toBeUndefined();
  });
});
