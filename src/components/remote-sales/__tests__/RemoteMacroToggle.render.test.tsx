// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { RemoteMacroToggle } from "../RemoteMacroToggle";

/**
 * Remote Sales → Macro Mode switch (0303). Pinned 2026-11-23: it reflects the saved setting; turning it on shows the
 * server's answer; a failed save flips it BACK and says why (never left showing a state that wasn't saved); a failed
 * read falls back to off — the full module — so the switch can never become a one-way door.
 */
const fetchMock = vi.fn();
const sw = () => screen.getByRole("switch", { name: /macro mode/i });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("Macro Mode switch", () => {
  it("reflects the saved setting", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) });
    render(<RemoteMacroToggle />);
    await waitFor(() => expect(sw().getAttribute("aria-checked")).toBe("true"));
  });

  it("turning it on saves it and shows what the server holds", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) });
    render(<RemoteMacroToggle />);
    await waitFor(() => expect(sw().hasAttribute("disabled")).toBe(false));
    fireEvent.click(sw());
    await waitFor(() => expect(sw().getAttribute("aria-checked")).toBe("true"));
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1].body))).toEqual({ enabled: true });
  });

  it("a failed save flips it back and says why", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Macro Mode could not be saved to your profile." }) });
    render(<RemoteMacroToggle />);
    await waitFor(() => expect(sw().hasAttribute("disabled")).toBe(false));
    fireEvent.click(sw());
    expect(await screen.findByText(/could not be saved to your profile/i)).toBeTruthy();
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });

  it("a failed read falls back to off (the full module), still switchable", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<RemoteMacroToggle />);
    await waitFor(() => expect(sw().hasAttribute("disabled")).toBe(false));
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });
});
