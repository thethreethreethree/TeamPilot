// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TeamUsage } from "../TeamUsage";

/** Team usage shows time on calls and the average call (F10.7); unknown lengths are flagged, never averaged as zero. */
const counts = (calls: number) => ({ signIns: 1, calls, questions: 0, practice: 0, pipeline: 0 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TeamUsage — time on calls", () => {
  it("shows hours on calls and the average; marks a row with an untimed call", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      rows: [
        { id: "a", name: "Ana", last7: counts(3), last30: counts(3), lastActive: null, time7: { seconds: 2 * 3600 + 5 * 60, timed: 2 }, time30: { seconds: 7500, timed: 2 } },
        { id: "b", name: "Bo", last7: counts(0), last30: counts(0), lastActive: null, time7: { seconds: 0, timed: 0 }, time30: { seconds: 0, timed: 0 } },
      ],
      active7: 1, active30: 1, people: 2, totals7: counts(3), totals30: counts(3), capped: [],
    }) })));
    render(<TeamUsage />);
    expect(await screen.findByText("Time on calls")).toBeTruthy();
    expect(screen.getByText("2h 05m*")).toBeTruthy(); // 3 calls, 2 with a known length
    expect(screen.getByText("62:30")).toBeTruthy(); // 7500 s ÷ 2
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2); // Bo: no time, no average
  });
});

describe("TeamUsage — connect rate (F25.8)", () => {
  it("shows the share of calls with an outcome that reached someone, and a dash when none had one", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      rows: [
        { id: "a", name: "Ana", last7: counts(4), last30: counts(4), lastActive: null, time7: { seconds: 0, timed: 0 }, time30: { seconds: 0, timed: 0 }, reached7: { reached: 3, withOutcome: 4 }, reached30: { reached: 3, withOutcome: 4 } },
        { id: "b", name: "Bo", last7: counts(1), last30: counts(1), lastActive: null, time7: { seconds: 0, timed: 0 }, time30: { seconds: 0, timed: 0 }, reached7: { reached: 0, withOutcome: 0 }, reached30: { reached: 0, withOutcome: 0 } },
      ],
      active7: 2, active30: 2, people: 2, totals7: counts(5), totals30: counts(5), capped: [],
    }) })));
    render(<TeamUsage />);
    expect(await screen.findByText("Reached")).toBeTruthy();
    expect(screen.getByText("75%").getAttribute("title")).toBe("3 of 4 calls with an outcome");
    expect(screen.getByTitle("No phone or video call has an outcome yet").textContent).toBe("—");
  });
});
