// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { TeamCoverage } from "../TeamCoverage";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const SINCE = "2026-10-26T12:00:00.000Z";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TeamCoverage (F10.11)", () => {
  it("each tracker and topic with its share and count, linking to those calls on Search for the period", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      urls.push(u);
      return json({
        days: 30, since: SINCE, calls: 8, enough: true,
        trackers: [{ id: "t1", name: "Pricing", active: true, calls: 6, share: 0.75 }, { id: "t2", name: "Old", active: false, calls: 1, share: 0.125 }],
        topics: [{ topic: "Budget & timing", calls: 2, share: 0.25 }],
      });
    }));
    render(<TeamCoverage />);
    expect((await screen.findByRole("link", { name: "Pricing" })).getAttribute("href")).toBe("/dashboard/remote-sales/search?tracker=t1&from=2026-10-26");
    expect(screen.getByText(/75%/).textContent).toContain("6 of 8");
    expect(screen.getByRole("link", { name: "Old (retired)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Budget & timing" }).getAttribute("href")).toBe("/dashboard/remote-sales/search?topic=Budget%20%26%20timing&from=2026-10-26");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(urls).toContain("/api/coach/remote/coverage?days=7"));
  });
  it("too few calls: says so instead of a percentage", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ days: 30, since: SINCE, calls: 3, enough: false, trackers: [], topics: [] })));
    render(<TeamCoverage />);
    expect((await screen.findByText(/Only 3 finished phone or video calls/)).textContent).toContain("Shares appear from 4 calls");
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("no trackers: points to setting one up", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ days: 30, since: SINCE, calls: 5, enough: true, trackers: [], topics: [] })));
    render(<TeamCoverage />);
    expect((await screen.findByRole("link", { name: "Set one up" })).getAttribute("href")).toBe("/dashboard/remote-sales/trackers");
  });
  it("a rep (403) sees nothing; a failure says so", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({}, 403)));
    const { container } = render(<TeamCoverage />);
    await waitFor(() => expect(container.textContent).toBe(""));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => json({}, 500)));
    render(<TeamCoverage />);
    expect(await screen.findByText(/Couldn.t load what the team.s calls cover/)).toBeTruthy();
  });
});
