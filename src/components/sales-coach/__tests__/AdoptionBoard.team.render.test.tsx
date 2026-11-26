// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Adoption by team (F18.4, 2026-11-26): managers switch the board to a grid of messages × teams; reps don't get it. */
import { AdoptionBoard } from "../AdoptionBoard";

const ROW = { id: "t1", name: "Bundle", calls: 4, said: 2, rate: 0.5, goal: null, goalStatus: null };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdoptionBoard — by team", () => {
  it("a manager switches to By team and sees each team's share, with said/calls", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      urls.push(u);
      const byTeam = u.includes("by=team");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(byTeam
          ? { rows: [{ ...ROW, byTeam: [{ teamId: "m1", calls: 3, said: 2, rate: 2 / 3 }, { teamId: "m2", calls: 0, said: 0, rate: null }] }], teams: [{ id: "m1", name: "Max's team" }, { id: "m2", name: "Rae's team" }] }
          : { rows: [ROW] }),
      });
    }));
    render(<AdoptionBoard onOpen={() => {}} canManage />);
    await screen.findByText("Bundle");
    fireEvent.click(screen.getByRole("button", { name: "By team" }));
    const grid = await screen.findByLabelText("Adoption by team");
    expect(grid.textContent).toContain("Max's team");
    expect(grid.textContent).toContain("67%2/3");
    expect(grid.textContent).toContain("—0/0");
    await waitFor(() => expect(urls.some((u) => u.includes("by=team"))).toBe(true));
  });
  it("a rep has no By team switch", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [ROW] }) })));
    render(<AdoptionBoard onOpen={() => {}} />);
    await screen.findByText("Bundle");
    expect(screen.queryByRole("button", { name: "By team" })).toBeNull();
  });
});
