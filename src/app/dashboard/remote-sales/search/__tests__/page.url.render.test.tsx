// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

/** 2026-11-25: Search opens with the filters in its URL (Team call stats links a rep's row to ?rep=…&from=…). */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/remote-sales/search" }));
import SearchCallsPage from "../page";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Search — filters from the URL", () => {
  it("runs the URL's search first", async () => {
    window.history.replaceState(null, "", "/dashboard/remote-sales/search?rep=11111111-1111-4111-8111-111111111111&from=2026-11-01");
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string) => (urls.push(u), json({ rows: [], searches: [], trackers: [], members: [], available: true }))));
    render(<SearchCallsPage />);
    await waitFor(() => expect(urls.some((u) => u.startsWith("/api/coach/remote/search?"))).toBe(true));
    const q = new URLSearchParams(urls.find((u) => u.startsWith("/api/coach/remote/search?"))!.split("?")[1]);
    expect(q.get("rep")).toBe("11111111-1111-4111-8111-111111111111");
    expect(q.get("from")).toBe("2026-11-01");
  });
  it("with no URL filters, the plain search as before", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string) => (urls.push(u), json({ rows: [], searches: [], trackers: [], members: [], available: true }))));
    render(<SearchCallsPage />);
    await waitFor(() => expect(urls.some((u) => u.startsWith("/api/coach/remote/search?"))).toBe(true));
    const q = new URLSearchParams(urls.find((u) => u.startsWith("/api/coach/remote/search?"))!.split("?")[1]);
    expect(q.get("rep")).toBeNull();
    expect(q.get("from")).toBeNull();
  });
});
