// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Prep-up UI (Team-Sync, founder 2026-08-22). Proves the form WIRES to the routes: it creates a draft prep on
 * mount, autosaves goal/topics (PATCH), and the document upload runs sign → storage → confirm and lists the
 * result. Consumer gate (test-the-consumer): a correct API is useless if the form doesn't call it.
 */

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }),
}));

import { MeetingPrepUp } from "../MeetingPrepUp";

type Call = { url: string; method: string; body: Record<string, unknown> | null };
function mockFetch(calls: Call[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url, method, body });
      if (url === "/api/coach/meeting-prep" && method === "POST") {
        return { ok: true, json: async () => ({ prep: { id: "prep-1", goal: "", topics: [], status: "draft" } }) };
      }
      if (url.endsWith("/document") && body?.kind === "sign") {
        return { ok: true, json: async () => ({ storagePath: "co1/x.pdf", token: "t" }) };
      }
      if (url.endsWith("/document") && body?.kind === "confirm") {
        return { ok: true, json: async () => ({ document: { id: "d1", filename: body.filename, kind: "pdf", note: "", extractedText: "agenda text" } }) };
      }
      return { ok: true, json: async () => ({ prep: { id: "prep-1" } }) };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MeetingPrepUp", () => {
  it("creates a draft on mount, then renders the goal + topics + documents sections", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    render(<MeetingPrepUp />);
    await waitFor(() => expect(screen.getByText("The goal of this meeting")).toBeTruthy());
    expect(calls.some((c) => c.url === "/api/coach/meeting-prep" && c.method === "POST")).toBe(true); // draft created
    expect(screen.getByText("Must-discuss topics")).toBeTruthy();
    expect(screen.getByText("Documents")).toBeTruthy();
  });

  it("adds a topic and autosaves it (PATCH with the topic)", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    render(<MeetingPrepUp />);
    await waitFor(() => expect(screen.getByText("Must-discuss topics")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText(/Add a topic/i), { target: { value: "pricing" } });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByText("pricing")).toBeTruthy();
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "PATCH" && Array.isArray(c.body?.topics) && (c.body!.topics as Array<{ text: string }>).some((t) => t.text === "pricing")
        )
      ).toBe(true)
    );
  });

  it("flushes a pending save BEFORE Start, so a quick type→Start never binds an empty prep (audit H2)", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    const started: string[] = [];
    render(<MeetingPrepUp onStart={(id) => started.push(id)} />);
    await waitFor(() => expect(screen.getByText("The goal of this meeting")).toBeTruthy());
    // Type a goal and IMMEDIATELY tap Start (inside the 700ms debounce — the old bug dropped this save on unmount).
    fireEvent.change(screen.getByPlaceholderText(/Agree the Q3/i), { target: { value: "Lock the launch date" } });
    fireEvent.click(screen.getByText("Start Meeting"));
    // The flush must PATCH the goal, and onStart must fire only AFTER the save resolved.
    await waitFor(() => expect(started).toEqual(["prep-1"]));
    const patched = calls.find((c) => c.method === "PATCH" && c.body?.goal === "Lock the launch date");
    expect(patched).toBeTruthy(); // the goal was persisted, not lost
  });

  it("shows an empty-prep nudge until a goal/topic is added, and never disables Start (audit D5)", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    render(<MeetingPrepUp />);
    await waitFor(() => expect(screen.getByText("The goal of this meeting")).toBeTruthy());
    // Empty prep → the nudge shows; Start stays ENABLED (a prep-less meeting is valid, just un-briefed).
    expect(screen.getByText(/This prep is empty/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start Meeting/i }).hasAttribute("disabled")).toBe(false);
    // Add a goal → the nudge disappears (the coach now has something to steer toward).
    fireEvent.change(screen.getByPlaceholderText(/Agree the Q3/i), { target: { value: "Lock the date" } });
    expect(screen.queryByText(/This prep is empty/i)).toBeNull();
  });

  it("the file input is keyboard-reachable (sr-only, not display:none) (audit M4)", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    render(<MeetingPrepUp />);
    await waitFor(() => expect(screen.getByText("Documents")).toBeTruthy());
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.className).toContain("sr-only");
    expect(input.className).not.toContain("hidden"); // display:none would drop it from the tab order
  });

  it("a text/pdf pick runs sign → confirm and lists the document", async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    render(<MeetingPrepUp />);
    await waitFor(() => expect(screen.getByText("Documents")).toBeTruthy());
    const file = new File(["agenda"], "agenda.pdf", { type: "application/pdf" });
    // The hidden file input is the only file input on the form.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText("agenda.pdf")).toBeTruthy());
    expect(calls.some((c) => c.url.endsWith("/document") && c.body?.kind === "sign")).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/document") && c.body?.kind === "confirm")).toBe(true);
  });
});
