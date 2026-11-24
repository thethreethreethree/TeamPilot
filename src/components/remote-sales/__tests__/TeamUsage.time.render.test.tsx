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
