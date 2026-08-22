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
