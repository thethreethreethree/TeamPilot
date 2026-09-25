// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * SalesCoachShell — the frame around EVERY Sales Coach page, and never photographed until 2026-09-25.
 *
 * It holds 9 white-alpha sites, all inside `bg-brand-shell` — the desktop sidebar (:315) and the mobile
 * bottom nav (:467). `brand-shell` is a FIXED hex (#0B1620, tailwind.config.ts:57), not a theme variable,
 * so white alpha on it should be correct in both themes. "The source says so" is not evidence of the
 * render; this capture is.
 *
 * TWO WIDTHS, because the sidebar is `hidden md:flex` and the bottom nav is `md:hidden` — no single width
 * shows both, and a desktop-only shot would report the mobile nav fixed-and-unseen.
 *
 * Pathname is Coach Assessment — the page in the founder's screenshot — so the active item renders.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/coach-assessment",
}));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true }));
// A floating button of its own, not part of the frame being photographed.
vi.mock("@/components/learning/LearningModeFab", () => ({ LearningModeFab: () => null }));

import { SalesCoachShell } from "@/components/sales-coach/SalesCoachShell";

const shell = () => (
  <SalesCoachShell>
    <div style={{ padding: 32 }}>Page content sits here.</div>
  </SalesCoachShell>
);

describe("capture", () => {
  it("shell, desktop sidebar", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
    const { container } = render(shell());
    // Manager-only nav entry: absent for a rep AND while the role is still loading (items stay hidden).
    await screen.findAllByText(/Coach Assessment/i, undefined, { timeout: 8000 });
    capture("shell-desktop", container, { width: 1280, height: 900 });
  });

  it("shell, mobile bottom nav", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
    const { container } = render(shell());
    await screen.findAllByText(/Coach Assessment/i, undefined, { timeout: 8000 });
    capture("shell-mobile", container, { width: 390, height: 844 });
  });
});
