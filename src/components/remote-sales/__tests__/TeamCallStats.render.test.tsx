// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { TeamCallStats } from "../TeamCallStats";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const A = (o: object) => ({ calls: 0, talkRatioTime: null, longestRepMonologueMs: null, longestCustomerStoryMs: null, interactivity: null, patienceMs: null, repQuestionsPerHour: null, ...o });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TeamCallStats (F10.9)", () => {
  it("team row first, then reps; dashes where nothing was measurable; the period switch refetches", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string) => {
      urls.push(u);
      return json({ days: 30, team: A({ calls: 3, talkRatioTime: 0.5 }), reps: [{ repId: "a", name: "Ana", ...A({ calls: 2, talkRatioTime: 0.6, longestRepMonologueMs: 75_000 }) }] });
    }));
    render(<TeamCallStats />);
    const rows = await screen.findAllByRole("row");
    expect(rows.slice(1).map((r) => r.querySelector("td")?.textContent)).toEqual(["Team", "Ana"]);
    expect(rows[2]!.textContent).toContain("60%");
    expect(rows[2]!.textContent).toContain("1:15");
    expect(rows[2]!.textContent).toContain("—");
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    await waitFor(() => expect(urls).toContain("/api/coach/remote/team-stats?days=90"));
  });
  it("a rep (403) sees nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({}, 403)));
    const { container } = render(<TeamCallStats />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
