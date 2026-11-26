// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DealDrivers } from "../DealDrivers";

/** Drivers 30 / 90 days ago (0382): a recorded day is shown by the same rule; a day with no record says so. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const deals = [{ id: "d", repId: "a", name: "D", status: "open" as const, amount: 100, nextCallDate: null, lastCallAt: "2026-11-25T10:00:00Z", createdAt: "2026-11-01T00:00:00Z", nextTodo: null }];

describe("DealDrivers", () => {
  it("a day with no record says nothing was recorded, not 'no warnings'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ day: "2026-10-28", recorded: false, rows: [] }))));
    render(<DealDrivers deals={deals} nameOf={() => "Sam"} today="2026-11-27" />);
    fireEvent.click(screen.getByRole("button", { name: "30 days ago" }));
    expect(await screen.findByText(/Nothing was recorded on 2026-10-28/)).toBeTruthy();
  });
  it("a recorded day shows its shares", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ day: "2026-08-29", recorded: true, rows: [{ rep_id: "a", reasons: ["ghosted"] }, { rep_id: "a", reasons: [] }] }))));
    render(<DealDrivers deals={deals} nameOf={() => "Sam"} today="2026-11-27" />);
    fireEvent.click(screen.getByRole("button", { name: "90 days ago" }));
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(screen.getByText(/on 2026-08-29, as recorded that night/)).toBeTruthy();
  });
});
