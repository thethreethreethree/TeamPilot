// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * TodaysMetricsPager — the Macro "Today's Metrics" two-page module (founder spec 2026-09-04). The two child
 * dashboards have their own tests; here we lock the PAGER SHELL: default page = Progress (gamified), the toggle
 * switches pages, and a horizontal-dominant swipe flips the page while a vertical drag does NOT (so it never
 * hijacks scroll). Children are stubbed so the test is about the pager, not their content.
 */
vi.mock("../RepArena", () => ({ RepArena: () => <div data-testid="arena">ARENA</div> }));
vi.mock("../doorlog/TodaysMetrics", () => ({ TodaysMetrics: () => <div data-testid="metrics">METRICS</div> }));

import { TodaysMetricsPager } from "../TodaysMetricsPager";

afterEach(cleanup);

const track = (c: HTMLElement) => c.querySelector('[style*="translateX"]') as HTMLElement;
const swipe = (el: Element, dx: number, dy: number) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 400 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 400 + dy }] });
};

describe("TodaysMetricsPager — shell", () => {
  it("defaults to the Progress (gamified) page", () => {
    const { container } = render(<TodaysMetricsPager />);
    expect(screen.getByRole("tab", { name: "Progress" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Metrics" }).getAttribute("aria-selected")).toBe("false");
    expect(track(container).style.transform).toBe("translateX(-0%)");
    // both panes mount (so a swipe reveals a ready page), but Progress is the visible one.
    expect(screen.getByTestId("arena")).toBeTruthy();
    expect(screen.getByTestId("metrics")).toBeTruthy();
  });

  it("the toggle switches to Metrics and back", () => {
    const { container } = render(<TodaysMetricsPager />);
    fireEvent.click(screen.getByRole("tab", { name: "Metrics" }));
    expect(screen.getByRole("tab", { name: "Metrics" }).getAttribute("aria-selected")).toBe("true");
    expect(track(container).style.transform).toBe("translateX(-50%)");
    fireEvent.click(screen.getByRole("tab", { name: "Progress" }));
    expect(track(container).style.transform).toBe("translateX(-0%)");
  });

  it("a horizontal-dominant left swipe advances to Metrics; right swipe goes back", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    swipe(vp, -120, 10); // left, horizontal-dominant → next page
    expect(track(container).style.transform).toBe("translateX(-50%)");
    swipe(vp, 120, -10); // right → previous page
    expect(track(container).style.transform).toBe("translateX(-0%)");
  });

  it("a vertical drag does NOT change the page (scroll is not hijacked)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    swipe(vp, 15, -200); // mostly vertical → no switch
    expect(track(container).style.transform).toBe("translateX(-0%)");
  });

  it("a tiny movement (tap) does not change the page", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    swipe(vp, 8, 4); // below the 50px threshold → no switch
    expect(track(container).style.transform).toBe("translateX(-0%)");
  });

  it("cannot swipe past the ends (no third page)", () => {
    const { container } = render(<TodaysMetricsPager />);
    const vp = track(container).parentElement as HTMLElement;
    swipe(vp, 120, 0); // right at page 0 → stays at 0
    expect(track(container).style.transform).toBe("translateX(-0%)");
    swipe(vp, -120, 0); // to page 1
    swipe(vp, -120, 0); // left again at page 1 → stays at 1 (no page 2)
    expect(track(container).style.transform).toBe("translateX(-50%)");
  });
});
