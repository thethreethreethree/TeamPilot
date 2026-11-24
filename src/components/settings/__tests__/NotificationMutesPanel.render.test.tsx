// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NotificationMutesPanel } from "../NotificationMutesPanel";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NotificationMutesPanel", () => {
  it("shows the four FYI notices with muted ones off, says action notices always arrive, and saves a switch", async () => {
    const puts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "PUT") {
        puts.push(JSON.parse(init.body!));
        return json({ ok: true });
      }
      return json({ muted: ["call_scored"] });
    }));
    render(<NotificationMutesPanel />);
    const scored = (await screen.findByLabelText("Your call is scored")) as HTMLInputElement;
    expect(scored.checked).toBe(false);
    expect((screen.getByLabelText("A rep closed a deal") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/always arrive/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("A rep closed a deal"));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(JSON.stringify(puts)).toBe(JSON.stringify([{ type: "deal_closed", muted: true }])); // on → off = muted
    await waitFor(() => expect((screen.getByLabelText("A rep closed a deal") as HTMLInputElement).checked).toBe(false));
    fireEvent.click(screen.getByLabelText("Your call is scored")); // off → on = unmuted
    await waitFor(() => expect(puts.length).toBe(2));
    expect(JSON.stringify(puts[1])).toBe(JSON.stringify({ type: "call_scored", muted: false }));
  });
});
