// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** 0362 (F12.7): a manager shares their own saved search; a search someone shared says who, and can't be removed by you. */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true, useCurrentUserRole: () => "Manager", isCompanyAdminRole: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/remote-sales/search" }));
import SearchCallsPage from "../page";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Search — sharing a saved search (0362)", () => {
  it("shares my own search; someone else's shows who shared it and has no remove or share button", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string; body?: string }) => {
      if (u === "/api/coach/remote/saved-searches/events") {
        posts.push(JSON.parse(init?.body ?? "{}"));
        return json({ ok: true });
      }
      if (u === "/api/coach/remote/saved-searches")
        return json({ available: true, searches: [
          { id: "s1", name: "Price talk", query: "q=price", following: false, newCount: 0, newCapped: false, mine: true, shared: false, sharedBy: null },
          { id: "s9", name: "Team demos", query: "q=demo", following: false, newCount: 0, newCapped: false, mine: false, shared: true, sharedBy: "Max" },
        ] });
      return json({ rows: [], trackers: [], members: [] });
    }));
    render(<SearchCallsPage />);
    expect(await screen.findByText("· shared by Max")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove saved search Team demos" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Share Team demos/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share Price talk with the team" }));
    await waitFor(() => expect(posts).toContainEqual({ id: "s1", kind: "share" }));
    expect((await screen.findByRole("button", { name: "Stop sharing Price talk with the team" })).getAttribute("aria-pressed")).toBe("true");
  });
});
