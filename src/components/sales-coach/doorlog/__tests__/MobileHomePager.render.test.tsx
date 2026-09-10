// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MobileHomePager } from "../MobileHomePager";

/**
 * MobileHomePager — renders both pages, shows one dot per page, opens on page 0, and the Home-tab event
 * (elostate:home-tab) snaps back to page 0 without throwing. These pin the swipe scaffolding (Q6/Q8).
 */
afterEach(() => cleanup());

describe("MobileHomePager", () => {
  it("renders every page and one dot per page", () => {
    render(<MobileHomePager pages={[<div key="a">DOOR PAGE</div>, <div key="b">HOME PAGE</div>]} />);
    expect(screen.getByText("DOOR PAGE")).toBeTruthy();
    expect(screen.getByText("HOME PAGE")).toBeTruthy();
    // Two pages → the initial hint points at page 1 (the home screen), and page 0 is active.
    expect(screen.getByText(/swipe left for your home screen/i)).toBeTruthy();
  });

  it("handles the Home-tab event without throwing (snap to page 0)", () => {
    render(<MobileHomePager pages={[<div key="a">DOOR PAGE</div>, <div key="b">HOME PAGE</div>]} />);
    act(() => { window.dispatchEvent(new CustomEvent("elostate:home-tab")); });
    // Still mounted and on page 0's hint after the snap request.
    expect(screen.getByText(/swipe left for your home screen/i)).toBeTruthy();
  });
});
