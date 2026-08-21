import { describe, it, expect, vi } from "vitest";
import type { CueLLM } from "../coachingStrategy";

// SalesStrategy pulls in generateLiveCue (→ the sales engine); mock it so importing the registry is side-effect
// free (we only assert which strategy is selected, never run one).
vi.mock("@/lib/coach/v5/liveCue", () => ({ generateLiveCue: vi.fn() }));

const { selectStrategy } = await import("../selectStrategy");

const cueLLM: CueLLM = async () => ({ text: "{}" });

describe("selectStrategy — mode → brain (single-source)", () => {
  it("returns the MeetingStrategy for 'meeting'", () => {
    expect(selectStrategy("meeting", { cueLLM }).kind).toBe("meeting");
  });
  it("returns the HuddleStrategy for 'huddle'", () => {
    expect(selectStrategy("huddle", { cueLLM }).kind).toBe("huddle");
  });
  it("returns the SalesStrategy for 'sales'", () => {
    expect(selectStrategy("sales", { cueLLM }).kind).toBe("sales");
  });
  it("throws on an unknown mode (defensive — the type guard prevents this at compile time)", () => {
    expect(() => selectStrategy("standup" as never, { cueLLM })).toThrow(/unknown coaching mode/i);
  });
});
