// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Market → turn a topic into a keyword tracker (2026-11-23; ledger F14.4). Managers only; wordings become phrases. */
const role = vi.hoisted(() => ({ manager: true }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => role.manager }));
import { MarketView } from "../MarketView";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const MARKET = { calls: 10, withIntel: 9, closed: 0, winRate: null, competitors: [], topics: [{ name: "internet speed", calls: 7, variants: ["internet speeds"] }] };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  role.manager = true;
});

describe("Market → Track a topic", () => {
  it("a manager tracks a topic: its wordings, the customer's side, then a scan", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url === "/api/coach/remote/trackers" && init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ id: "t1" }, 201);
      }
      if (url.includes("/market/topic-groups")) return json({ canManage: false, groups: [] });
      return json(MARKET);
    }));
    render(<MarketView module="remote_sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Track internet speed" }));
    expect(await screen.findByText("Tracking ✓")).toBeTruthy();
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[0]).toEqual({ name: "internet speed", phrases: ["internet speed", "internet speeds"], side: "customer" });
    expect(posts[1]).toEqual({ action: "scan" });
  });
  it("a refusal is shown next to the topic", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string }) => (url === "/api/coach/remote/trackers" && init?.method === "POST" ? json({ error: "A tracker with that name exists." }, 400) : url.includes("/market/topic-groups") ? json({ canManage: false, groups: [] }) : json(MARKET))));
    render(<MarketView module="remote_sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Track internet speed" }));
    expect(await screen.findByText("A tracker with that name exists.")).toBeTruthy();
  });
  it("a rep sees no Track button", async () => {
    role.manager = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/market/topic-groups") ? json({ canManage: false, groups: [] }) : json(MARKET))));
    render(<MarketView module="remote_sales" />);
    await screen.findByText(/internet speed/);
    expect(screen.queryByRole("button", { name: /^Track / })).toBeNull();
  });
});
