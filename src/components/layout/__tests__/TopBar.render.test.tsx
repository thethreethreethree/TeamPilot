// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Render guard for the systemic mobile back affordance (audit F1/F2, founder pick 2026-08-23). The Sales Coach
 * mobile surface has only the bottom tab bar for chrome, so a non-tab page (Roleplay, One Liners, …) that renders
 * TopBar gave a rep no in-page way back. TopBar now shows a mobile "← Back" (router.back()) on any SC route EXCEPT
 * the SC home — and never on non-SC routes (which keep their hamburger). This locks that contract.
 */

const back = vi.fn();
let pathname = "/dashboard/sales-coach/roleplay";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ back, push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

import TopBar from "../TopBar";

beforeEach(() => {
  back.mockClear();
});
afterEach(() => cleanup());

describe("TopBar — systemic Sales Coach mobile back button (audit F1/F2)", () => {
  it("a non-tab SC page shows a back button (not the hamburger) and it calls router.back()", () => {
    pathname = "/dashboard/sales-coach/roleplay";
    render(<TopBar title="Roleplay Practice" />);
    const backBtn = screen.getByLabelText("Go back");
    expect(backBtn).toBeTruthy();
    expect(screen.queryByLabelText("Open menu")).toBeNull(); // no hamburger on SC routes
    fireEvent.click(backBtn);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("the SC home does NOT show a back button (nothing to go back to — it's the hub)", () => {
    pathname = "/dashboard/sales-coach";
    render(<TopBar title="Sales Coach" />);
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });

  it("a non-Sales-Coach route keeps its hamburger and shows no SC back button", () => {
    pathname = "/dashboard/operations";
    render(<TopBar title="Operations" />);
    expect(screen.getByLabelText("Open menu")).toBeTruthy();
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });
});
