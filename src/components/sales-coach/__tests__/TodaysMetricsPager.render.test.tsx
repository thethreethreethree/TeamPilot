// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * TodaysMetricsPager — the Macro "Today's Metrics" module, THREE pages since 2026-09-22 (Progress | Breakdown
 * | Metrics, the rep dashboard sheet's sub-nav). The child
 * dashboards have their own tests; here we lock the PAGER SHELL: default page = Progress (gamified), the toggle
 * and arrow keys switch pages, and a finger-follow swipe (touchstart→move→end) flips the page on a
 * horizontal-dominant drag while a vertical drag does NOT (so it never hijacks scroll). Children are stubbed.
 */
vi.mock("../RepArena", () => ({ RepArena: () => <div data-testid="arena">ARENA</div> }));
vi.mock("../doorlog/TodaysMetrics", () => ({ TodaysMetrics: () => <div data-testid="metrics">METRICS</div> }));
vi.mock("../PitchBreakdown", () => ({ PitchBreakdown: () => <div data-testid="breakdown">BREAKDOWN</div> }));
vi.mock("../PitchMilestones", () => ({ PitchMilestones: () => <div data-testid="milestones">MILESTONES</div> }));

import { TodaysMetricsPager } from "../TodaysMetricsPager";

afterEach(cleanup);

const track = (c: HTMLElement) => c.querySelector('[style*="translateX"]') as HTMLElement;
/**
 * Which pane is showing, read from the track's own offset.
 *
 * Offsets are now THIRDS, not halves — the pager took a third page on 2026-09-22 and its geometry
 * is derived from PAGES.length. This helper used to test for "-50%" and would report page 0 for
 * every page of a three-pane track, which is a test that cannot fail.
 */
const pageOf = (c: HTMLElement) => {
  const t = track(c).style.transform;
  const m = /-([\d.]+)%/.exec(t);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]!) / (100 / 3));
};
// A finger drag: down, move by (dx,dy), up — the axis locks on the move (mirrors a real gesture).
const drag = (el: Element, dx: number, dy: number) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 400 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx, clientY: 400 + dy }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 400 + dy }] });
};

describe("TodaysMetricsPager — shell", () => {
  it("defaults to the Progress (gamified) page", () => {
    const { container } = render(<TodaysMetricsPager />);
    expect(screen.getByRole("tab", { name: "Progress" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Metrics" }).getAttribute("aria-selected")).toBe("false");
    expect(pageOf(container)).toBe(0);
    expect(screen.getByTestId("arena")).toBeTruthy();
    expect(screen.getByTestId("metrics")).toBeTruthy();
  });

  it("the toggle switches to Metrics and back", () => {
    const { container } = render(<TodaysMetricsPager />);
    fireEvent.click(screen.getByRole("tab", { name: "Metrics" }));
    expect(screen.getByRole("tab", { name: "Metrics" }).getAttribute("aria-selected")).toBe("true");
    // Metrics is the THIRD pane now, not the second — Breakdown sits between them.
    expect(pageOf(container)).toBe(2);
    fireEvent.click(screen.getByRole("tab", { name: "Progress" }));
    expect(pageOf(container)).toBe(0);
  });

  it("a horizontal-dominant left drag advances to Metrics; right drag goes back", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    drag(vp, -120, 10); // left, horizontal-dominant → next page
    expect(pageOf(container)).toBe(1);
    drag(vp, 120, -10); // right → previous page
    expect(pageOf(container)).toBe(0);
  });

  it("follows the finger mid-drag, then snaps back if released short of the threshold", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    fireEvent.touchStart(vp, { touches: [{ clientX: 200, clientY: 400 }] });
    fireEvent.touchMove(vp, { touches: [{ clientX: 160, clientY: 402 }] }); // -40px: follows, but under the 50px snap floor
    expect(track(container).style.transform).toContain("-40px"); // the track tracked the finger
    fireEvent.touchEnd(vp, { changedTouches: [{ clientX: 160, clientY: 402 }] });
    expect(pageOf(container)).toBe(0); // released short → snapped back to Progress
  });

  it("a vertical drag does NOT change the page (scroll is not hijacked)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    drag(vp, 15, -200); // mostly vertical → axis locks 'v', no page change
    expect(pageOf(container)).toBe(0);
  });

  it("a tiny movement (tap) does not change the page", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    drag(vp, 5, 3); // below the axis-lock threshold → no drag, no switch
    expect(pageOf(container)).toBe(0);
  });

  it("fulfills the role=tablist keyboard contract (arrows + Home/End, roving tabindex)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const progress = screen.getByRole("tab", { name: "Progress" });
    const metrics = screen.getByRole("tab", { name: "Metrics" });
    expect(progress.getAttribute("tabindex")).toBe("0");
    expect(metrics.getAttribute("tabindex")).toBe("-1");
    // ArrowRight now lands on BREAKDOWN, which sits between the two — the sheet's order.
    const breakdown = screen.getByRole("tab", { name: "Breakdown" });
    fireEvent.keyDown(progress, { key: "ArrowRight" });
    expect(breakdown.getAttribute("aria-selected")).toBe("true");
    expect(pageOf(container)).toBe(1);
    expect(breakdown.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(breakdown, { key: "ArrowRight" });
    expect(metrics.getAttribute("aria-selected")).toBe("true");
    expect(pageOf(container)).toBe(2);
    fireEvent.keyDown(metrics, { key: "ArrowLeft" });
    expect(breakdown.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(breakdown, { key: "End" });
    expect(metrics.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(metrics, { key: "Home" });
    expect(progress.getAttribute("aria-selected")).toBe("true");
  });

  it("cannot advance past the ends (there is no fourth page)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    drag(vp, 120, 0); // right at page 0 → stays at 0
    expect(pageOf(container)).toBe(0);
    drag(vp, -120, 0); // → Breakdown
    expect(pageOf(container)).toBe(1);
    drag(vp, -120, 0); // → Metrics
    expect(pageOf(container)).toBe(2);
    drag(vp, -120, 0); // left again at the last page → stays
    expect(pageOf(container)).toBe(2);
  });

  it("reaches the Breakdown a rep could not reach before", () => {
    // The point of the third pane. These tabs existed on /my-progress, whose nav entry is
    // managerOnly — so the rep they were built for could not open them.
    render(<TodaysMetricsPager />);
    fireEvent.click(screen.getByRole("tab", { name: "Breakdown" }));
    expect(screen.getByTestId("breakdown")).toBeTruthy();
  });

  it("carries the Pitch Score milestone strip on the Progress pane", () => {
    // It was orphaned when the duplicate sub-nav was deleted — caught by reachability:audit, which
    // is the gate that exists because three modules in one feature had no caller in one day.
    render(<TodaysMetricsPager />);
    expect(screen.getByTestId("milestones")).toBeTruthy();
  });

  it("sizes the track and the panes from the page count", () => {
    // jsdom has no layout, so the geometry is only checkable as style strings — and it has to be
    // checked. A track left at 200% with three panes clips the last one, and nothing about the
    // page state, the tabs or the transform would be wrong. Both mutations survived until this.
    const { container } = render(<TodaysMetricsPager />);
    const t = track(container);
    expect(t.style.width).toBe("300%");

    const panes = [...t.children] as HTMLElement[];
    expect(panes).toHaveLength(3);
    for (const pane of panes) {
      // 100/3 with whatever precision the browser kept — asserted as a third rather than a literal.
      expect(Math.abs(parseFloat(pane.style.width) - 100 / 3)).toBeLessThan(0.01);
    }
  });

  it("puts Breakdown between Progress and Metrics, which is the sheet's order", () => {
    render(<TodaysMetricsPager />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Progress", "Breakdown", "Metrics",
    ]);
  });
});
