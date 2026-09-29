// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

/**
 * The quiet undo (0267; founder 2026-09-29: "a quiet 'undo' for a few seconds").
 *
 * Driven the way a rep uses it: tap No Answer, see "Logged: No Answer · Undo", tap Undo — and the SAME door is
 * taken back (the undo names the knock's own clientKnockId). Plus the three ways it could lie: offering undo
 * for a knock the server refused, staying on screen forever, or reporting success when the undo failed.
 */

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession: async () => ({}) },
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
  }),
}));
vi.mock("../useDoorRecorder", () => ({
  useDoorRecorder: () => ({
    armed: true, recording: false, level: 0, elapsedMs: 0,
    arm: vi.fn(async () => true), start: vi.fn(async () => true),
    stop: vi.fn(async () => ({ blob: new Blob([new Uint8Array(2048)]), durationMs: 5000 })),
  }),
}));

import { DoorLog, UNDO_MS } from "../DoorLog";

type Post = { kind: string; clientKnockId?: string; outcome?: string };
let posts: Post[] = [];
let answer: (b: Post) => { ok: boolean; status: number } = () => ({ ok: true, status: 200 });

beforeEach(() => {
  posts = [];
  answer = () => ({ ok: true, status: 200 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        const b = JSON.parse(init.body ?? "{}") as Post;
        posts.push(b);
        const r = answer(b);
        return { ...r, json: async () => ({ ok: r.ok }) };
      }
      return { ok: true, status: 200, json: async () => ({ doorsKnocked: 0, sold: 0, goBacks: 0, notInterested: 0 }) };
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("DoorLog — the quiet undo", () => {
  it("offers Undo after a confirmed No Answer, and takes back THAT door", async () => {
    render(<DoorLog />);
    fireEvent.click(screen.getByText("No Answer"));
    const undo = await screen.findByRole("button", { name: "Undo" });
    expect(screen.getByRole("status").textContent).toMatch(/Logged:\s*No Answer/);

    fireEvent.click(undo);
    await waitFor(() => expect(posts.some((p) => p.kind === "undo")).toBe(true));
    const knock = posts.find((p) => p.kind === "knock")!;
    const undone = posts.find((p) => p.kind === "undo")!;
    expect(undone.clientKnockId).toBe(knock.clientKnockId); // the same door, not "the last one on the server"
    expect(await screen.findByText(/Undone — that No Answer no longer counts/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("does not offer Undo for a knock the server refused", async () => {
    answer = (b) => (b.kind === "knock" ? { ok: false, status: 400 } : { ok: true, status: 200 });
    render(<DoorLog />);
    fireEvent.click(screen.getByText("No Answer"));
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    await screen.findByText(/That knock/i); // the honest failure line
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("goes away on its own — it is quiet, not a permanent button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<DoorLog />);
    fireEvent.click(screen.getByText("No Answer"));
    await screen.findByRole("button", { name: "Undo" });
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS + 50);
    });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("says so when the undo fails — the door is still counted", async () => {
    answer = (b) => (b.kind === "undo" ? { ok: false, status: 409 } : { ok: true, status: 200 });
    render(<DoorLog />);
    fireEvent.click(screen.getByText("No Answer"));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText(/Couldn't undo that No Answer\. It is still counted\./)).toBeTruthy();
    expect(screen.queryByText(/no longer counts/i)).toBeNull();
  });
});
