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
import { ThemeProvider } from "@/components/theme/ThemeProvider";

/**
 * TopBar now renders a ThemeToggle on Sales Coach routes, and `useTheme` throws outside its
 * provider — deliberately, so a component reaching for the theme in the wrong place fails at the
 * call site instead of silently rendering the wrong mode.
 *
 * Wrapping here is not a workaround for that throw; it is these tests catching up with reality.
 * `ThemeProvider` wraps `{children}` at the root `<body>` in app/layout.tsx, so EVERY page in the
 * app already renders inside it — the same structural guarantee Sidebar and CareShell rely on.
 * Rendering TopBar bare was the thing that did not match production.
 */
const withTheme = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => {
  back.mockClear();
  // ThemeProvider reads both on mount. jsdom has neither, and an unmocked matchMedia throws.
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});
afterEach(() => cleanup());

describe("TopBar — systemic Sales Coach mobile back button (audit F1/F2)", () => {
  it("a non-tab SC page shows a back button (not the hamburger) and it calls router.back()", () => {
    pathname = "/dashboard/sales-coach/roleplay";
    withTheme(<TopBar title="Roleplay Practice" />);
    const backBtn = screen.getByLabelText("Go back");
    expect(backBtn).toBeTruthy();
    expect(screen.queryByLabelText("Open menu")).toBeNull(); // no hamburger on SC routes
    fireEvent.click(backBtn);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("the SC home does NOT show a back button (nothing to go back to — it's the hub)", () => {
    pathname = "/dashboard/sales-coach";
    withTheme(<TopBar title="Sales Coach" />);
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });

  it("a non-Sales-Coach route keeps its hamburger and shows no SC back button", () => {
    pathname = "/dashboard/operations";
    withTheme(<TopBar title="Operations" />);
    expect(screen.getByLabelText("Open menu")).toBeTruthy();
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });
});

describe("TopBar — light/dark on Sales Coach (founder 2026-09-24)", () => {
  it("offers a theme control on a Sales Coach route", () => {
    // SalesCoachShell renders its OWN nav and never mounts the ELOSTATE Sidebar, which is where the
    // app's other ThemeToggle lives. So before this, a rep or manager inside Sales Coach had no way
    // to change the theme from ANY screen in the module.
    pathname = "/dashboard/sales-coach/coach-assessment";
    withTheme(<TopBar title="Coach Assessment" />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeTruthy();
  });

  it("does NOT offer one outside Sales Coach, where the Sidebar already has it", () => {
    // Two controls for one setting on the same screen is worse than one in the wrong place.
    pathname = "/dashboard/finance";
    withTheme(<TopBar title="Finance" />);
    expect(screen.queryByRole("button", { name: /theme/i })).toBeNull();
  });
});
