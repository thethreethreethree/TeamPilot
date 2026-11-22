// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { LlmConnectionPanel as Panel } from "../LlmConnectionPanel";

/** Settings → LLM connection. Pinned 2026-11-23: a failed health read is said — not every provider shown as unconfigured. */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("LLM connection panel", () => {
  it("shows configured providers from the health read", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ capabilities: { providers: { deepseek: true, anthropic: false }, activeProvider: "deepseek" } }) });
    render(<Panel />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/couldn.t read which providers are configured/i)).toBeNull();
  });

  it("a failed health read says so, instead of implying no key is set", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Panel />);
    expect(await screen.findByText(/couldn.t read which providers are configured/i)).toBeTruthy();
  });
});
