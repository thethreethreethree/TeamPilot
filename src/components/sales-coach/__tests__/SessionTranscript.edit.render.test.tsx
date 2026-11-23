// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SessionTranscript } from "../SessionTranscript";

/** Editable transcripts (0311) on screen: who gets the pencil, what a save sends, and the "edited" mark. */
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const SEGS = [{ speaker: "agent", text: "we can do fifteen a month", seq: 1, spoken_at: null }];

describe("SessionTranscript editing", () => {
  it("an editor corrects a line; the edited mark shows the original words", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url.includes("transcript-edit") && init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ ok: true, changed: true, version: 2 });
      }
      if (url.includes("transcript-edit")) return json({ canEdit: true, edits: [{ seq: 1, original: "we can do fifty a month", editedAt: "2026-11-23T10:00:00Z", editedByName: "Rob", count: 1 }] });
      return json({ segments: SEGS });
    }));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText("we can do fifteen a month")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "edited" }));
    expect(screen.getByText(/Originally: “we can do fifty a month”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Correct this line" }));
    fireEvent.change(screen.getByLabelText("Corrected words for this line"), { target: { value: "we can do sixteen a month" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(await screen.findByText(/Keyword hits and talk stats now use the corrected words/)).toBeTruthy();
    expect(posts).toEqual([{ seq: 1, text: "we can do sixteen a month" }]);
  });

  it("someone who can't edit gets no pencil", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("transcript-edit") ? json({ canEdit: false, edits: [] }) : json({ segments: SEGS }))));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText("we can do fifteen a month")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Correct this line" })).toBeNull();
  });
});
