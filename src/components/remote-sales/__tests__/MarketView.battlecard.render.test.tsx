// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Market → a competitor's battlecard (Engage E14; Gong F13.11): written on request from its calls, cited, not saved; a refusal is said. */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false }));
import { MarketView } from "../MarketView";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const MARKET = { calls: 10, withIntel: 9, closed: 0, winRate: null, topics: [], competitors: [{ name: "Spectrum", calls: 4, share: 0.4, closed: 0, winRate: null, weeks: [] }] };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Market → Battlecard", () => {
  it("asks for the competitor's battlecard with the page's module and days; shows it cited and not saved", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url === "/api/coach/remote/market/battlecard") {
        posts.push(JSON.parse(init!.body!));
        return json({ answer: "Objections we hear\n- Price went up [1]", citations: [{ ref: 1, sessionId: "s1", seq: 4, atMs: 65_000 }], calls: 3 });
      }
      if (url.includes("/market/topic-groups")) return json({ canManage: false, groups: [] });
      return json(MARKET);
    }));
    render(<MarketView module="remote_sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Battlecard" }));
    const card = await screen.findByRole("region", { name: "Battlecard: Spectrum" });
    await waitFor(() => expect(card.textContent).toMatch(/Price went up/));
    expect(card.textContent).toMatch(/3 newest calls that named it · written now, not saved/);
    expect(card.textContent).toMatch(/1:05/);
    expect(posts).toEqual([{ competitor: "Spectrum", module: "remote_sales", days: 90 }]);
  });
  it("a refusal (no calls, AI off) is said in the card", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url === "/api/coach/remote/market/battlecard" ? json({ error: "No call in view named Spectrum." }, 404) : url.includes("/market/topic-groups") ? json({ canManage: false, groups: [] }) : json(MARKET))));
    render(<MarketView module="remote_sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Battlecard" }));
    expect(await screen.findByText("No call in view named Spectrum.")).toBeTruthy();
  });
  it("Copy puts the card on the clipboard with call times for citations (E14 R2)", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.stubGlobal("fetch", vi.fn((url: string) => (url === "/api/coach/remote/market/battlecard" ? json({ answer: "Price went up [1]", citations: [{ ref: 1, sessionId: "s1", seq: 4, atMs: 65_000 }], calls: 3, labels: { s1: "2026-11-20 · Acme" } }) : url.includes("/market/topic-groups") ? json({ canManage: false, groups: [] }) : json(MARKET))));
    render(<MarketView module="remote_sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Battlecard" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Battlecard: Spectrum\n\nPrice went up (2026-11-20 · Acme, 1:05)"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
