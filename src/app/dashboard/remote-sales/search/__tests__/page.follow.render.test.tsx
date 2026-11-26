// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** 0342 (F12.7): a followed saved search shows its new calls; opening it marks them seen; the bell toggles follow. */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/remote-sales/search" }));
import SearchCallsPage from "../page";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const SAVED = [
  { id: "s1", name: "Price talk", query: "q=price", following: true, newCount: 3, newCapped: false },
  { id: "s2", name: "Demos", query: "q=demo", following: false, newCount: 0, newCapped: false },
];
const setup = (eventOk = true) => {
  const posts: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string; body?: string }) => {
    if (init?.method === "POST") posts.push({ url: u, body: JSON.parse(init.body ?? "{}") });
    if (u === "/api/coach/remote/saved-searches/events") return json({ ok: eventOk }, eventOk);
    if (u === "/api/coach/remote/saved-searches") return json({ available: true, searches: SAVED });
    return json({ rows: [], trackers: [], members: [] });
  }));
  render(<SearchCallsPage />);
  return posts;
};

describe("Search — following a saved search (0342)", () => {
  it("shows the new count; opening the search marks it seen and clears the badge", async () => {
    const posts = setup();
    expect(await screen.findByText(/3\s*new/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Price talk" }));
    await waitFor(() => expect(posts).toContainEqual({ url: "/api/coach/remote/saved-searches/events", body: { id: "s1", kind: "seen" } }));
    await waitFor(() => expect(screen.queryByText(/3\s*new/)).toBeNull());
  });
  it("the bell follows and unfollows", async () => {
    const posts = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Follow Demos: show new matching calls" }));
    await waitFor(() => expect(posts).toContainEqual({ url: "/api/coach/remote/saved-searches/events", body: { id: "s2", kind: "follow" } }));
    expect((await screen.findByRole("button", { name: "Stop following Demos" })).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Stop following Price talk" }));
    await waitFor(() => expect(posts).toContainEqual({ url: "/api/coach/remote/saved-searches/events", body: { id: "s1", kind: "unfollow" } }));
  });
  it("a failed toggle leaves the state as it was and says so", async () => {
    setup(false);
    fireEvent.click(await screen.findByRole("button", { name: "Follow Demos: show new matching calls" }));
    expect(await screen.findByText("Couldn't change that saved search.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Follow Demos: show new matching calls" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("a count that couldn't be completed shows 'new?', never nothing", async () => {
    vi.stubGlobal("fetch", vi.fn((u: string) =>
      u === "/api/coach/remote/saved-searches" ? json({ available: true, searches: [{ id: "s9", name: "Busy", query: "q=the", following: true, newCount: 0, newCapped: true }] }) : json({ rows: [], trackers: [], members: [] }),
    ));
    render(<SearchCallsPage />);
    expect(await screen.findByText("new?")).toBeTruthy();
  });

  it("opened from the bell (?saved=s1): the search's filters apply and its new calls are marked seen (2026-11-26)", async () => {
    window.history.replaceState(null, "", "/dashboard/remote-sales/search?q=price&saved=s1");
    const posts = setup();
    await waitFor(() => expect(posts).toContainEqual({ url: "/api/coach/remote/saved-searches/events", body: { id: "s1", kind: "seen" } }));
    await waitFor(() => expect(screen.queryByText(/3\s*new/)).toBeNull());
    expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("price");
    window.history.replaceState(null, "", "/");
  });
  it("a ?saved= for a search that isn't followed writes nothing", async () => {
    window.history.replaceState(null, "", "/dashboard/remote-sales/search?saved=s2");
    const posts = setup();
    await screen.findByText(/3\s*new/);
    expect(posts.filter((p) => p.url.endsWith("/events"))).toEqual([]);
    window.history.replaceState(null, "", "/");
  });
});

