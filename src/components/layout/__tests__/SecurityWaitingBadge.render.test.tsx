// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SecurityWaitingBadge } from "../SecurityWaitingBadge";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SecurityWaitingBadge", () => {
  it("shows how many reports wait for a response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ waiting: 2 })));
    render(<SecurityWaitingBadge refreshKey="/x" />);
    expect((await screen.findByLabelText("2 reports waiting for a response")).textContent).toBe("2");
  });
  it("nothing at zero, and nothing (not '0') when the count couldn't be read", async () => {
    const f = vi.fn(() => json({ waiting: 0 }));
    vi.stubGlobal("fetch", f);
    const a = render(<SecurityWaitingBadge refreshKey="/x" />);
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(a.container.innerHTML).toBe("");
    cleanup();
    const g = vi.fn(() => json({ error: "x" }, 500));
    vi.stubGlobal("fetch", g);
    const b = render(<SecurityWaitingBadge refreshKey="/x" />);
    await vi.waitFor(() => expect(g).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(b.container.innerHTML).toBe("");
  });
});
