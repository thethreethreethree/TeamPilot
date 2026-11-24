// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusView } from "../StatusView";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const health = { backend: { supabase: { reachable: true } }, capabilities: { llmReady: true, email: false, webhooks: false }, build: { commit: "abc123" } };

describe("StatusView (F36.34)", () => {
  it("working parts, 'not switched on' parts, and nothing internal", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(health) })));
    const { container } = render(<StatusView />);
    expect(await screen.findByText("All systems working")).toBeTruthy();
    expect(screen.getAllByText("Not switched on")).toHaveLength(2);
    expect(container.textContent).not.toContain("abc123");
  });
  it("a failed check says so, never 'all working'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<StatusView />);
    expect(await screen.findByText(/couldn't check the status/)).toBeTruthy();
  });
});
