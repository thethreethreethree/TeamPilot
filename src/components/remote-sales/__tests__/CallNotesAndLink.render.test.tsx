// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CallNotes } from "../CallNotes";
import { CallPipelineLink } from "../CallPipelineLink";

/**
 * Two controls on every remote call page (2026-11-23): the rep's notes, and which prospect the call belongs to.
 * What could fail a person on screen: a note box that hides who can read it, a manager offered a box they can't use,
 * a failed load shown as "no notes"; a link control that only creates new prospects, or offers "add" on a linked call.
 */
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CallNotes", () => {
  it("the rep sees notes with their moment, who can read them, and can add one", async () => {
    const posts: unknown[] = [];
    let notes: Array<{ id: number; atMs: number | null; body: string; authorName: string; createdAt: string }> = [{ id: 1, atMs: 65_000, body: "Price came up", authorName: "Rob", createdAt: "2026-11-23T10:00:00Z" }];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        notes = [...notes, { id: 2, atMs: null, body: "Send quote", authorName: "Rob", createdAt: "2026-11-23T10:05:00Z" }];
        return json({ ok: true });
      }
      return json({ canWrite: true, notes });
    }));
    const seek = vi.fn();
    render(<CallNotes sessionId="s1" onSeek={seek} />);
    expect(await screen.findByText("Price came up")).toBeTruthy();
    expect(screen.getByText(/Your managers can read your notes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play from 1:05" }));
    expect(seek).toHaveBeenCalledWith(65);
    fireEvent.change(screen.getByLabelText("New note"), { target: { value: "Send quote" } });
    fireEvent.click(screen.getByRole("button", { name: /Add note/ }));
    expect(await screen.findByText("Send quote")).toBeTruthy();
    expect(posts).toEqual([{ body: "Send quote" }]);
  });

  it("a manager reads notes but gets no box; a failed load says so", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ canWrite: false, notes: [{ id: 1, atMs: null, body: "A note", authorName: "Rob", createdAt: "2026-11-23T10:00:00Z" }] })));
    render(<CallNotes sessionId="s1" />);
    expect(await screen.findByText("A note")).toBeTruthy();
    expect(screen.queryByLabelText("New note")).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "x" }, 500)));
    render(<CallNotes sessionId="s1" />);
    expect(await screen.findByText(/Couldn.t load the notes on this call/)).toBeTruthy();
  });
});

describe("CallPipelineLink", () => {
  it("the rep can add the call to an EXISTING prospect", async () => {
    const calls: Array<[string, unknown]> = [];
    let linked = false;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        calls.push([url, JSON.parse(init.body!)]);
        linked = true;
        return json({ ok: true });
      }
      return json(linked
        ? { remote: true, live: false, isOwner: true, label: "Betty", prospect: { id: "p1", name: "Acme", status: "open" }, options: [] }
        : { remote: true, live: false, isOwner: true, label: "Betty", prospect: null, options: [{ id: "p1", name: "Acme", organization: null }] });
    }));
    const onLinked = vi.fn();
    render(<CallPipelineLink sessionId="s1" onLinked={onLinked} />);
    expect(await screen.findByRole("option", { name: "New prospect: Betty" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Prospect for this call"), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: /Add to pipeline/ }));
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(calls).toEqual([["/api/coach/remote/prospects/p1", { action: "link", sessionId: "s1" }]]);
    await waitFor(() => expect(onLinked).toHaveBeenCalled());
  });

  it("a linked call shows its prospect and offers no add; a failed check doesn't offer add either", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ remote: true, live: false, isOwner: true, label: "B", prospect: { id: "p1", name: "Acme", status: "won" }, options: [] })));
    render(<CallPipelineLink sessionId="s1" />);
    expect(await screen.findByText("Closed won")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to pipeline/ })).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "x" }, 500)));
    render(<CallPipelineLink sessionId="s1" />);
    expect(await screen.findByText(/Couldn.t check which prospect/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to pipeline/ })).toBeNull();
  });
});
