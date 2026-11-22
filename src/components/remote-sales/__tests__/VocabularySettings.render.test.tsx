// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { VocabularySettings } from "../VocabularySettings";

/**
 * Protection → Transcription vocabulary (0306). Pinned 2026-11-23: empty is "off"; a rep reads the list and can't edit;
 * an admin edits and saves the list; clearing it is a "Turn off"; a failed load says so (never "off").
 */
const fetchMock = vi.fn();
const serve = (vocab: unknown, put: unknown = { terms: ["AT&T Fiber", "Spectrum"] }) =>
  fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) =>
    init?.method === "PUT" ? { ok: true, json: async () => put } : vocab === "FAIL" ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => vocab },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("transcription vocabulary", () => {
  it("an empty list is 'off'", async () => {
    serve({ terms: [], canManage: true, max: 100 });
    render(<VocabularySettings />);
    expect(await screen.findByText(/now: off/i)).toBeTruthy();
  });

  it("a rep reads the list and cannot edit it", async () => {
    serve({ terms: ["AT&T Fiber", "Spectrum"], canManage: false, max: 100 });
    render(<VocabularySettings />);
    expect(await screen.findByText("AT&T Fiber · Spectrum")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an admin saves one term per line", async () => {
    serve({ terms: [], canManage: true, max: 100 });
    render(<VocabularySettings />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "AT&T Fiber\n  Spectrum \n\n" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(String(put[1].body))).toEqual({ terms: ["AT&T Fiber", "Spectrum"] });
  });

  it("clearing the list offers 'Turn off'", async () => {
    serve({ terms: ["Spectrum"], canManage: true, max: 100 });
    render(<VocabularySettings />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: /turn off/i })).toBeTruthy();
  });

  it("a failed load says so — never 'off'", async () => {
    serve("FAIL");
    render(<VocabularySettings />);
    expect(await screen.findByText(/couldn.t load the vocabulary/i)).toBeTruthy();
    expect(screen.queryByText(/now: off/i)).toBeNull();
  });
});
