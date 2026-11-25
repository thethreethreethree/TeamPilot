// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GettingStarted } from "../GettingStarted";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const steps = (done: boolean[]) => ["call", "checklist", "prospect", "practice"].map((key, i) => ({ key, label: `Step ${key}`, href: "/x", done: done[i] }));
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GettingStarted (F36.40)", () => {
  it("shows progress and the open steps as links; Hide is remembered", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ steps: steps([true, false, false, false]), complete: false })));
    const { unmount } = render(<GettingStarted />);
    expect(await screen.findByText("Getting started · 1 of 4")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Step checklist" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Hide/ }));
    expect(screen.queryByText(/Getting started/)).toBeNull();
    unmount();
    render(<GettingStarted />);
    expect(screen.queryByText(/Getting started/)).toBeNull();
  });
  it("all done: nothing shows", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ steps: steps([true, true, true, true]), complete: true })));
    const { container } = render(<GettingStarted />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
