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
  it("on-demand agents (E9): a button runs the saved agent by id over the same calls; the answer says it wasn't saved", async () => {
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (!init?.method) return new Response(JSON.stringify({ agents: [{ id: "a1", name: "Risks raised", instruction: "List every risk." }] }));
      posts.push({ url: String(u), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ answer: "Price [1].", citations: [] }));
    }));
    render(<AskCalls title="Ask about this deal" calls={calls.slice(0, 3)} onDemand />);
    fireEvent.click(await screen.findByRole("button", { name: "Risks raised" }));
    expect(await screen.findByText(/Risks raised · not saved/)).toBeTruthy();
    expect(posts).toEqual([{ url: "/api/coach/remote/on-demand-agents", body: { run: "a1", sessionIds: ["s0", "s1", "s2"] } }]);
  });
  it("without onDemand, no agents are fetched; a failed list shows none and the box still works", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (urls.push(String(u)), new Response("{}", { status: 500 }))));
    render(<AskCalls title="Ask" calls={calls.slice(0, 1)} />);
    expect(urls).toEqual([]);
    cleanup();
    render(<AskCalls title="Ask" calls={calls.slice(0, 1)} onDemand />);
    await waitFor(() => expect(urls).toEqual(["/api/coach/remote/on-demand-agents"]));
    expect(screen.queryByRole("group", { name: "On-demand agents" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
  });
  it("past 10 calls, deep asks up to 50 of them in one question (E18); off by default", async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ sessionId: `m${i}`, label: `Call ${i}` }));
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => (bodies.push(JSON.parse(String(init!.body))), new Response(JSON.stringify({ answer: "Deep answer.", citations: [] })))));
    render(<AskCalls title="Ask about this account" calls={many} starters={["Who decides?"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Who decides?" }));
    await waitFor(() => expect(bodies[0]).toEqual({ question: "Who decides?", sessionIds: many.slice(0, 10).map((c) => c.sessionId) }));
    fireEvent.click(screen.getByLabelText(/Ask all 23 calls \(deep/));
    fireEvent.click(screen.getByRole("button", { name: "Who decides?" }));
    await waitFor(() => expect(bodies[1]).toEqual({ question: "Who decides?", sessionIds: many.map((c) => c.sessionId), deep: true }));
    expect(screen.getByText(/deep: 23 of 23 calls, read 10 at a time/)).toBeTruthy();
  });
});
