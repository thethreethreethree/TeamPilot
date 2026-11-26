// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TrainingManager } from "../TrainingManager";

/** F17.3: opened from a call (?fromSession=…), the manager can have the AI draft the scenario, then edit and save it. */
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
const drafts: unknown[] = [];
beforeEach(() => {
  drafts.length = 0;
  window.history.replaceState(null, "", "/dashboard/remote-sales/training?fromSession=call-1");
  vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
    if (url === "/api/coach/remote/scenarios/draft") {
      drafts.push(JSON.parse(init!.body!));
      return json({ draft: { title: "The price-shopper", persona: "Busy owner with two quotes", situation: "Wants the lowest price.", focus: "Price objection" } });
    }
    if (url.startsWith("/api/coach/remote/scenarios")) return json({ scenarios: [], tags: [], stages: [], items: [] });
    if (url.startsWith("/api/coach/remote/assignments")) return json({ assignments: [] });
    if (url === "/api/coach/remote/assignable-reps") return json({ members: [] });
    return json({}, false);
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("TrainingManager — draft from a call", () => {
  it("fills the form from the call's draft for the manager to check", async () => {
    render(<TrainingManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Draft it from the call" }));
    expect(await screen.findByDisplayValue("The price-shopper")).toBeTruthy();
    expect(screen.getByDisplayValue("Busy owner with two quotes")).toBeTruthy();
    expect(screen.getByDisplayValue("Price objection")).toBeTruthy();
    expect(screen.getByText(/check it, change anything, then save/)).toBeTruthy();
    expect(drafts).toEqual([{ sessionId: "call-1" }]);
  });
});
