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

  it("with corrections, an editor can ask once for the AI notes to be redone", async () => {
    const puts: string[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string }) => {
      if (url.includes("transcript-edit") && init?.method === "PUT") {
        puts.push(url);
        return json({ ok: true, refreshing: true });
      }
      if (url.includes("transcript-edit")) return json({ canEdit: true, edits: [{ seq: 1, original: "x", editedAt: "2026-11-23T10:00:00Z", editedByName: "Rob", count: 1 }] });
      return json({ segments: SEGS });
    }));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Refresh the AI notes with these corrections" }));
    expect(await screen.findByText(/Refreshing the summary, review and follow-through/)).toBeTruthy();
    expect(puts).toEqual(["/api/coach/sales-session/s1/transcript-edit"]);
    expect(screen.queryByRole("button", { name: "Refresh the AI notes with these corrections" })).toBeNull();
  });
  it("no corrections, or no right to edit: no refresh button", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("transcript-edit") ? json({ canEdit: true, edits: [] }) : json({ segments: SEGS }))));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    await screen.findByText("we can do fifteen a month");
    expect(screen.queryByRole("button", { name: /Refresh the AI notes/ })).toBeNull();
  });

  it("notes built after the latest correction: no prompt to refresh; older notes: the prompt says why", async () => {
    const edit = { seq: 1, original: "x", editedAt: "2026-11-23T10:00:00Z", editedByName: "Rob", count: 1 };
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("transcript-edit") ? json({ canEdit: true, edits: [edit], notesBuiltAt: "2026-11-23T11:00:00Z" }) : json({ segments: SEGS }))));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    await screen.findByText("we can do fifteen a month");
    expect(screen.queryByRole("button", { name: /Refresh the AI notes/ })).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("transcript-edit") ? json({ canEdit: true, edits: [edit], notesBuiltAt: "2026-11-23T09:00:00Z" }) : json({ segments: SEGS }))));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText(/were made before your latest correction/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Refresh the AI notes/ })).toBeTruthy();
  });

  it("a line credited to the wrong person: 'Said by the customer' sends a speaker change (0328)", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url.includes("transcript-edit") && init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ ok: true, changed: true, version: 2 });
      }
      if (url.includes("transcript-edit")) return json({ canEdit: true, edits: [] });
      return json({ segments: SEGS });
    }));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Correct this line" }));
    fireEvent.click(screen.getByRole("button", { name: "Said by the customer" }));
    expect(await screen.findByText(/that line is now the customer.s/)).toBeTruthy();
    expect(posts).toEqual([{ seq: 1, speaker: "customer" }]);
  });
  it("a speaker change alone also dates the AI notes (latestEditAt), so the refresh is offered", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("transcript-edit") ? json({ canEdit: true, edits: [], latestEditAt: "2026-11-23T12:00:00Z", notesBuiltAt: "2026-11-23T10:00:00Z" }) : json({ segments: SEGS }))));
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByRole("button", { name: /Refresh the AI notes/ })).toBeTruthy();
  });
});

