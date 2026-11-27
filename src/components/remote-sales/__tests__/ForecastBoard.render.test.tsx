// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ForecastBoard } from "../ForecastBoard";

/** The forecast board (0376): rows, the team roll-up with how many submitted, and a failed read said as one. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const deals = [
  { repId: "me", status: "won" as const, amount: 1000, closedAt: "2026-11-02T10:00:00Z" },
  { repId: "r2", status: "open" as const, amount: 400, closeDate: "2026-12-10" },
];

describe("ForecastBoard", () => {
  it("shows each person, the team row and how many have submitted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      period: "2026-Q4", viewerId: "me",
      submissions: [{ userId: "me", period: "2026-Q4", category: "commit", amount: 900, note: null, createdAt: "2026-11-20T00:00:00Z" }],
      targets: [{ userId: "me", period: "2026-Q4", amount: 2000 }],
    }))));
    render(<ForecastBoard deals={deals} people={["me", "r2"]} isManager nameOf={(id) => (id === "r2" ? "Sam" : null)} today="2026-11-27" />);
    expect(await screen.findByText("You")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getAllByText("1 of 2 submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("50% of target")).toBeTruthy();
  });
  it("a reply in the wrong shape is a failed read, not an empty board", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ prospects: [] }))));
    render(<ForecastBoard deals={deals} people={[]} isManager={false} nameOf={() => null} today="2026-11-27" />);
    expect(await screen.findByText(/Couldn.t load the forecast/)).toBeTruthy();
  });
  it("opening a rep's submitted number shows the deals behind it and how it moved, with nothing to edit (F22.3, F22.6)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      period: "2026-Q4", viewerId: "me",
      submissions: [
        { userId: "r2", period: "2026-Q4", category: "commit", amount: 300, createdAt: "2026-11-10T00:00:00Z", deals: [{ id: "d1", amount: 300 }] },
        { userId: "r2", period: "2026-Q4", category: "commit", amount: 700, createdAt: "2026-11-20T00:00:00Z", deals: [{ id: "d2", amount: 400 }, { id: "dx", amount: 300 }] },
      ],
      targets: [],
    }))));
    const named = [{ id: "d1", name: "Acme", repId: "r2", status: "open" as const, amount: 300, closeDate: "2026-12-01" }, { id: "d2", name: "Globex", repId: "r2", status: "open" as const, amount: 400, closeDate: "2026-12-10" }];
    render(<ForecastBoard deals={named} people={["me", "r2"]} isManager nameOf={(id) => (id === "r2" ? "Sam" : null)} today="2026-11-27" />);
    fireEvent.click(await screen.findByRole("button", { name: /700/ }));
    expect(screen.getByText(/2 open deals behind it: Globex, 1 more/)).toBeTruthy();
    expect(screen.getByText(/up \$400; in: Globex, 1 more; out: Acme/)).toBeTruthy();
    expect(screen.queryByLabelText("Amount")).toBeNull();
  });
  it("a manager sets the team's revenue target (0386); the team row shows progress to it", async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ ok: true }));
      }
      return new Response(JSON.stringify({ period: "2026-Q4", viewerId: "me", submissions: [], targets: [{ userId: "me", period: "2026-Q4", amount: 4000, team: true }] }));
    }));
    render(<ForecastBoard deals={deals} people={["me", "r2"]} isManager nameOf={(id) => (id === "r2" ? "Sam" : null)} today="2026-11-27" />);
    expect(await screen.findByText("25% of team target")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /4,000/ }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posts[0]).toEqual({ kind: "target", period: "2026-Q4", userId: "me", amount: 5000, team: true });
  });
  it("with one rep picked (not the whole team), the team row shows no team target and offers none (review)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ period: "2026-Q4", viewerId: "me", submissions: [], targets: [{ userId: "me", period: "2026-Q4", amount: 4000, team: true }] }))));
    render(<ForecastBoard deals={deals} people={["r2"]} isManager nameOf={(id) => (id === "r2" ? "Sam" : null)} today="2026-11-27" teamView={false} />);
    await screen.findByText("Team");
    expect(screen.queryByText(/of team target/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Set team target|4,000/ })).toBeNull();
  });
});

