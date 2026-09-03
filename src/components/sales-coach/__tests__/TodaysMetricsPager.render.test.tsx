// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * TodaysMetricsPager — the Macro "Today's Metrics" two-page module (founder spec 2026-09-04). The two child
 * dashboards have their own tests; here we lock the PAGER SHELL: default page = Progress (gamified), the toggle
 * and arrow keys switch pages, and a finger-follow swipe (touchstart→move→end) flips the page on a
 * horizontal-dominant drag while a vertical drag does NOT (so it never hijacks scroll). Children are stubbed.
 */
vi.mock("../RepArena", () => ({ RepArena: () => <div data-testid="arena">ARENA</div> }));
vi.mock("../doorlog/TodaysMetrics", () => ({ TodaysMetrics: () => <div data-testid="metrics">METRICS</div> }));

import { TodaysMetricsPager } from "../TodaysMetricsPager";

afterEach(cleanup);

const track = (c: HTMLElement) => c.querySelector('[style*="translateX"]') as HTMLElement;
const pageOf = (c: HTMLElement) => (track(c).style.transform.includes("-50%") ? 1 : 0);
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
    expect(pageOf(container)).toBe(1);
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
    fireEvent.keyDown(progress, { key: "ArrowRight" });
    expect(metrics.getAttribute("aria-selected")).toBe("true");
    expect(pageOf(container)).toBe(1);
    expect(metrics.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(metrics, { key: "ArrowLeft" });
    expect(progress.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(progress, { key: "End" });
    expect(metrics.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(metrics, { key: "Home" });
    expect(progress.getAttribute("aria-selected")).toBe("true");
  });

  it("cannot advance past the ends (no third page)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    drag(vp, 120, 0); // right at page 0 → stays at 0
    expect(pageOf(container)).toBe(0);
    drag(vp, -120, 0); // to page 1
    drag(vp, -120, 0); // left again at page 1 → stays at 1 (no page 2)
    expect(pageOf(container)).toBe(1);
  });
});
