// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AskCalls } from "../AskCalls";

/** Ask about a deal or account (revenue Phase 5): at most the 10 newest calls, once each; a starter asks at once; a failure says so. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const calls = Array.from({ length: 12 }, (_, i) => ({ sessionId: `s${i}`, label: `Call ${i}` }));

describe("AskCalls", () => {
  it("asks the 10 newest calls (each once) and says so", async () => {
    const bodies: Array<{ sessionIds: string[]; question: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => (bodies.push(JSON.parse(String(init!.body))), new Response(JSON.stringify({ answer: "They want March.", citations: [] })))));
    render(<AskCalls title="Ask about this deal" calls={[...calls, calls[0]!]} starters={["What's blocking this deal?"]} />);
    expect(screen.getByText(/the 10 most recent of 12 calls/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "What's blocking this deal?" }));
    expect(await screen.findByText(/They want March/)).toBeTruthy();
    expect(bodies[0]!.sessionIds).toEqual(calls.slice(0, 10).map((c) => c.sessionId));
    expect(bodies[0]!.question).toBe("What's blocking this deal?");
  });
  it("a failed answer is said, not shown as an answer; no calls shows nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "The coach couldn't answer." }), { status: 502 })));
    render(<AskCalls title="Ask" calls={calls.slice(0, 2)} />);
    fireEvent.change(screen.getByPlaceholderText(/budget/), { target: { value: "Who decides?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't answer/));
    cleanup();
    const { container } = render(<AskCalls title="Ask" calls={[]} />);
    expect(container.textContent).toBe("");
  });
});
