// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * The rep dashboard's sub-nav.
 *
 * The thing worth testing is not that a tab switches. It is that only ONE panel is mounted at a
 * time — three boards behind three tabs each fetch on mount, and rendering all three and hiding
 * two with CSS would fire three requests and three spinners for a rep who wanted one number.
 * That is invisible in a screenshot and obvious in a network tab.
 */

vi.mock("../RepArena", () => ({ RepArena: () => <div>ARENA</div> }));
vi.mock("../PitchBreakdown", () => ({ PitchBreakdown: () => <div>BREAKDOWN</div> }));
vi.mock("../PitchMilestones", () => ({ PitchMilestones: () => <div>MILESTONES</div> }));
vi.mock("../doorlog/TodaysMetrics", () => ({ TodaysMetrics: () => <div>METRICS</div> }));

import { RepDashboardTabs } from "../RepDashboardTabs";

const tab = (name: RegExp) => screen.getByRole("tab", { name });

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("the three tabs the sheet names", () => {
  it("renders Progress, Breakdown and Metrics", () => {
    render(<RepDashboardTabs />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab(/^Progress$/)).toBeTruthy();
    expect(tab(/^Breakdown$/)).toBeTruthy();
    expect(tab(/^Metrics$/)).toBeTruthy();
  });

  it("opens on Progress", () => {
    // Where you stand, then why, then the field read. Opening on Breakdown would put thirty
    // percentages in front of a rep before they have a reason to care about them.
    render(<RepDashboardTabs />);
    expect(screen.getByText("ARENA")).toBeTruthy();
    expect(tab(/^Progress$/).getAttribute("aria-selected")).toBe("true");
  });

  it("puts both milestone strips on the Progress tab", () => {
    render(<RepDashboardTabs />);
    expect(screen.getByText("ARENA")).toBeTruthy();
    expect(screen.getByText("MILESTONES")).toBeTruthy();
  });
});

describe("one panel at a time", () => {
  it("does not mount the other boards on load", () => {
    // Each of these fetches on mount. Hiding them with CSS would cost three requests and three
    // spinners for a rep who opened one tab.
    render(<RepDashboardTabs />);
    expect(screen.queryByText("BREAKDOWN")).toBeNull();
    expect(screen.queryByText("METRICS")).toBeNull();
  });

  it("swaps the panel rather than adding to it", () => {
    render(<RepDashboardTabs />);
    fireEvent.click(tab(/^Metrics$/));
    expect(screen.getByText("METRICS")).toBeTruthy();
    expect(screen.queryByText("ARENA")).toBeNull();
    expect(screen.queryByText("MILESTONES")).toBeNull();
  });

  it("shows the breakdown only when asked for", () => {
    render(<RepDashboardTabs />);
    fireEvent.click(tab(/^Breakdown$/));
    expect(screen.getByText("BREAKDOWN")).toBeTruthy();
    expect(screen.queryByText("ARENA")).toBeNull();
  });
});

describe("it behaves like a tablist", () => {
  it("marks the selection for assistive tech, not only by colour", () => {
    render(<RepDashboardTabs />);
    fireEvent.click(tab(/^Breakdown$/));
    expect(tab(/^Breakdown$/).getAttribute("aria-selected")).toBe("true");
    expect(tab(/^Progress$/).getAttribute("aria-selected")).toBe("false");
  });

  it("keeps one tab stop, then arrow keys", () => {
    // A tablist is a single stop in the tab order. Three focusable tabs would make a keyboard user
    // press Tab three times to get past the nav.
    render(<RepDashboardTabs />);
    expect(tab(/^Progress$/).getAttribute("tabindex")).toBe("0");
    expect(tab(/^Breakdown$/).getAttribute("tabindex")).toBe("-1");
  });

  it("moves right and wraps", () => {
    render(<RepDashboardTabs />);
    fireEvent.keyDown(tab(/^Progress$/), { key: "ArrowRight" });
    expect(screen.getByText("BREAKDOWN")).toBeTruthy();
    fireEvent.keyDown(tab(/^Breakdown$/), { key: "ArrowRight" });
    expect(screen.getByText("METRICS")).toBeTruthy();
    fireEvent.keyDown(tab(/^Metrics$/), { key: "ArrowRight" });
    expect(screen.getByText("ARENA")).toBeTruthy();
  });

  it("moves left and wraps the other way", () => {
    render(<RepDashboardTabs />);
    fireEvent.keyDown(tab(/^Progress$/), { key: "ArrowLeft" });
    expect(screen.getByText("METRICS")).toBeTruthy();
  });

  it("jumps to the ends with Home and End", () => {
    render(<RepDashboardTabs />);
    fireEvent.keyDown(tab(/^Progress$/), { key: "End" });
    expect(screen.getByText("METRICS")).toBeTruthy();
    fireEvent.keyDown(tab(/^Metrics$/), { key: "Home" });
    expect(screen.getByText("ARENA")).toBeTruthy();
  });

  it("moves focus with the selection", () => {
    // A keyboard user who arrows to Metrics and presses Tab should land inside Metrics, not back
    // on the tab they started from.
    render(<RepDashboardTabs />);
    fireEvent.keyDown(tab(/^Progress$/), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab(/^Breakdown$/));
  });

  it("ignores keys that are not navigation", () => {
    // From a NON-default tab, because a handler that fell through to "go to the first tab" would
    // look identical from Progress — which is what a surviving mutation showed.
    render(<RepDashboardTabs />);
    fireEvent.click(tab(/^Metrics$/));
    fireEvent.keyDown(tab(/^Metrics$/), { key: "a" });
    expect(screen.getByText("METRICS")).toBeTruthy();
    expect(screen.queryByText("ARENA")).toBeNull();
  });

  it("ties each panel to its tab", () => {
    render(<RepDashboardTabs />);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tab(/^Progress$/).getAttribute("id"));
    expect(tab(/^Progress$/).getAttribute("aria-controls")).toBe(panel.getAttribute("id"));
  });
});
