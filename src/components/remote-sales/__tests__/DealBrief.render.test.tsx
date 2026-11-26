// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DealBrief } from "../DealBrief";

/**
 * The deal brief (0374; Gong F20.3, F20.4). Pinned: each point links the call line it rests on; a next step becomes a
 * to-do once; a stale brief offers a fresh one; a failed read says so.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const BRIEF = {
  standing: "Waiting on the CFO.",
  happened: [{ text: "Asked for a March start.", cites: [{ sessionId: "s1", seq: 4, atMs: 65_000 }] }],
  risks: [],
  next: [{ text: "Send the pricing sheet.", cites: [{ sessionId: "s1", seq: 9, atMs: null }] }],
};

describe("DealBrief", () => {
  it("cites each point's call line; a next step becomes a to-do once", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: true, brief: BRIEF, createdAt: "2026-11-27T10:00:00Z", stale: false }))));
    const addTodo = vi.fn(async () => true);
    render(<DealBrief dealId="d1" addTodo={addTodo} />);
    expect(await screen.findByText("Waiting on the CFO.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "[1:05]" }).getAttribute("href")).toBe("/dashboard/remote-sales/calls/s1?t=65");
    expect(screen.getByRole("link", { name: "[line 9]" }).getAttribute("href")).toBe("/dashboard/remote-sales/calls/s1");
    expect(screen.queryByRole("button", { name: /fresh brief/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add as to-do/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Added/ })).toBeTruthy());
    expect(addTodo).toHaveBeenCalledWith("Send the pricing sheet.");
    expect((screen.getByRole("button", { name: /Added/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("a stale brief says so and offers a fresh one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: true, brief: BRIEF, stale: true }))));
    render(<DealBrief dealId="d1" addTodo={vi.fn()} />);
    expect(await screen.findByText(/calls changed since this brief/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Write a fresh brief/ })).toBeTruthy();
  });
  it("a failed read is said, not shown as no brief", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<DealBrief dealId="d1" addTodo={vi.fn()} />);
    expect(await screen.findByText(/Couldn.t load this deal.s brief/)).toBeTruthy();
  });
});
