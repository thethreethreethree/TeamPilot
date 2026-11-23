// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { FeedbackRequest } from "../FeedbackRequest";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const req = (open: boolean) => ({ id: "r", createdAt: "2026-11-20T10:00:00Z", message: null, toNamedManager: true, open });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FeedbackRequest — seeing an answer (0321)", () => {
  it("the rep looking at an answered request records that they saw it", async () => {
    const f = vi.fn((url: string) => json(url.endsWith("/feedback-seen") ? { ok: true } : { available: true, mine: true, requests: [req(false)] }));
    vi.stubGlobal("fetch", f);
    render(<FeedbackRequest sessionId="s1" />);
    expect(await screen.findByText("Answered.")).toBeTruthy();
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u) === "/api/coach/remote/s1/feedback-seen")).toBe(true));
  });
  it("no view is recorded while the request is still open, or on someone else's call", async () => {
    const f = vi.fn((_u: string) => json({ available: true, mine: true, requests: [req(true)] }));
    vi.stubGlobal("fetch", f);
    render(<FeedbackRequest sessionId="s1" />);
    expect(await screen.findByText("Feedback requested")).toBeTruthy();
    cleanup();
    const g = vi.fn((_u: string) => json({ available: true, mine: false, requests: [req(false)] }));
    vi.stubGlobal("fetch", g);
    render(<FeedbackRequest sessionId="s1" />);
    await waitFor(() => expect(g).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect([...f.mock.calls, ...g.mock.calls].some(([u]) => String(u).endsWith("/feedback-seen"))).toBe(false);
  });
});
