// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace }), useSearchParams: () => new URLSearchParams() }));
const roles = vi.hoisted(() => ({ manager: false }));
vi.mock("@/lib/hooks/useCurrentUserRole", async (orig) => ({
  ...((await orig()) as object),
  useIsSalesCoachManager: () => roles.manager,
  useCurrentUserRole: () => (roles.manager ? "CEO" : "staff"),
}));

import { RemotePipeline } from "../RemotePipeline";

/**
 * Remote Sales → Pipeline (Macro Mode). Pinned 2026-11-23: stage totals and the list come from the read; the tabs
 * filter by stage; a failed read says so and shows NO totals — before this, after a manager switched "Whose pipeline"
 * and the read failed, the totals kept the previous person's numbers.
 */
const T = (open: [number, number], won: [number, number] = [0, 0], lost: [number, number] = [0, 0]) => ({
  open: { count: open[0], amount: open[1] }, won: { count: won[0], amount: won[1] }, lost: { count: lost[0], amount: lost[1] },
});
const P = (id: string, name: string, status: string, amount: number | null) => ({
  id, name, status, amount, organization: null, stageLabel: null, repId: "rep-1", nextTodo: null, openTodos: 0, nextCallDate: null, lastCallAt: null,
});
const MINE = { prospects: [P("p1", "Pat Prospect", "open", 1500), P("p2", "Won Co", "won", 900)], totals: T([1, 1500], [1, 900]), viewerId: "rep-1" };

const fetchMock = vi.fn();
const respond = (map: Record<string, unknown>) =>
  fetchMock.mockImplementation(async (url: string) => {
    for (const [k, v] of Object.entries(map)) if (String(url).includes(k)) return v === "FAIL" ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => v };
    return { ok: true, json: async () => ({}) };
  });

beforeEach(() => {
  vi.clearAllMocks();
  roles.manager = false;
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("the pipeline", () => {
  it("shows stage totals and the open prospects", async () => {
    respond({ "/api/coach/remote/prospects": MINE });
    render(<RemotePipeline />);
    expect(await screen.findByText("Pat Prospect")).toBeTruthy();
    expect(screen.queryByText("Won Co")).toBeNull();
    expect(screen.getAllByText(/1 prospect\b/).length).toBe(2);
  });

  it("the Closed Won tab lists the won deals", async () => {
    respond({ "/api/coach/remote/prospects": MINE });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    fireEvent.click(screen.getByRole("tab", { name: /closed won/i }));
    expect(screen.getByText("Won Co")).toBeTruthy();
    expect(screen.queryByText("Pat Prospect")).toBeNull();
  });

  it("a failed read says so, with no totals", async () => {
    respond({ "/api/coach/remote/prospects": "FAIL" });
    render(<RemotePipeline />);
    expect(await screen.findByText(/couldn.t load the pipeline/i)).toBeTruthy();
    expect(screen.queryByText(/\d+ prospects?\b/)).toBeNull();
  });

  it("switching to someone else's pipeline that fails does not keep showing the previous totals", async () => {
    roles.manager = true;
    respond({ "repId=rep-2": "FAIL", "/api/coach/remote/prospects": MINE, "/api/team": { members: [{ id: "rep-2", full_name: "Sam Rep" }] } });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    await screen.findByRole("option", { name: "Sam Rep" });
    fireEvent.change(screen.getByLabelText(/whose pipeline/i), { target: { value: "rep-2" } });
    expect(await screen.findByText(/couldn.t load the pipeline/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/1 prospect\b/)).toBeNull());
  });

  it("Forecast shows open deals by expected close month, with past-due apart and undated counted (0320)", async () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const late = { ...P("p3", "Late Co", "open", 400), closeDate: day(-3) };
    const soon = { ...P("p4", "Soon Co", "open", 2000), closeDate: day(40) };
    respond({ "/api/coach/remote/prospects": { ...MINE, prospects: [...MINE.prospects, late, soon] } });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    fireEvent.click(screen.getByRole("button", { name: "Forecast" }));
    const table = await screen.findByRole("region", { name: "By expected close month" });
    expect(table.textContent).toContain("Past due");
    expect(table.textContent).toContain("$400");
    expect(table.textContent).toContain("$2,000");
    expect(table.textContent).toContain("1 open deal has no expected close date ($1,500)");
    fireEvent.click(screen.getByRole("button", { name: "Quarters" }));
    expect(table.textContent).toMatch(/Q[1-4] 20\d\d/);
    expect(table.textContent).toContain("Past due");
  });

  it("what-if: moving a deal's date changes the months on screen and sends nothing", async () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const soon = { ...P("p4", "Soon Co", "open", 2000), closeDate: day(5) };
    respond({ "/api/coach/remote/prospects": { ...MINE, prospects: [soon] } });
    render(<RemotePipeline />);
    await screen.findByText("Soon Co");
    fireEvent.click(screen.getByRole("button", { name: "Forecast" }));
    const table = await screen.findByRole("region", { name: "By expected close month" });
    const before = table.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByRole("button", { name: /What if\?/ }));
    expect(screen.getByText(/nothing is saved/)).toBeTruthy();
    const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === "POST").length;
    const sent = posts();
    fireEvent.change(screen.getByLabelText("What-if close date for Soon Co"), { target: { value: day(-30) } });
    expect(table.textContent).toContain("Past due");
    expect(table.querySelectorAll("tbody tr").length).toBe(before); // moved from its month into Past due
    expect(posts()).toBe(sent);
    fireEvent.click(screen.getByRole("button", { name: "Back to the real dates" }));
    expect(table.textContent).not.toContain("Past due");
  });

  it("stage names already in use are offered in one spelling each (so stage practice tags match)", async () => {
    const a = { ...P("p1", "Pat Prospect", "open", 1500), stageLabel: "Demo" };
    const b = { ...P("p5", "Bea", "open", 100), stageLabel: "demo " };
    const c = { ...P("p6", "Cal", "open", 100), stageLabel: "Proposal" };
    const d = { ...P("p7", "Dee", "open", 100), stageLabel: "Demo" };
    respond({ "/api/coach/remote/prospects": { ...MINE, prospects: [a, b, c, d] } }); // "Demo" twice beats "demo " once
    const { container } = render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    const opts = [...container.querySelectorAll("datalist#stage-names-in-use option")].map((o) => o.getAttribute("value"));
    expect(opts).toEqual(["Demo", "Proposal"]);
  });

  it("Forecast lists what changed this week, from the pipeline's history; a click opens the prospect", async () => {
    respond({
      "/api/coach/remote/prospects/changes": {
        summary: { new: 0, newValue: 0, won: 1, wonValue: 900, lost: 0, lostValue: 0, moved: 1, slipped: 0 },
        trend: [{ at: "2026-11-09T00:00:00Z", open: 1, value: 500, unpriced: 0 }, { at: "2026-11-16T00:00:00Z", open: 1, value: 1500, unpriced: 0 }],
        changes: [
          { kind: "won", prospectId: "p2", at: new Date().toISOString(), amount: 900, name: "Won Co" },
          { kind: "stage", prospectId: "p1", at: new Date().toISOString(), from: "Discovery", to: "Demo", name: "Pat Prospect" },
        ],
      },
      "/api/coach/remote/prospects": MINE,
    });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    fireEvent.click(screen.getByRole("button", { name: "Forecast" }));
    const card = await screen.findByRole("region", { name: "Pipeline changes" });
    await waitFor(() => expect(card.textContent).toContain("Discovery → Demo"));
    expect(card.textContent).toContain("1 won ($900)");
    expect(screen.getByRole("region", { name: "Open deals by stage" }).textContent).toContain("No stage");
    const asked = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes("/prospects/changes"))!;
    expect(asked).toMatch(/from=.*&to=.*&weeks=8/);
    expect(card.textContent).toMatch(/Open pipeline over 8 weeks: \$500 → \$1,500/);
  });
  it("Sources shows win and loss by number of calls and deal size; a row below 5 closed deals gives no rate (F20.10)", async () => {
    const closed = [
      ...[1, 2, 3, 4].map((i) => ({ ...P(`w${i}`, `Won ${i}`, "won", 1000 * i), callCount: 3 })),
      { ...P("l1", "Lost 1", "lost", 500), callCount: 3 },
      { ...P("l2", "Lost 2", "lost", null), callCount: 0 },
    ];
    respond({ "/api/coach/remote/prospects": { ...MINE, prospects: [{ ...MINE.prospects[0], callCount: 1 }, ...closed] } });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    const calls = await screen.findByRole("table", { name: "By number of calls" }).catch(() => screen.getByLabelText("By number of calls"));
    expect(calls.textContent).toContain("2–3 calls");
    expect(calls.textContent).toMatch(/2–3 calls410?80%/); // 4 won, 1 lost → 80%
    expect(calls.textContent).toMatch(/No calls01too few to read/);
    expect(screen.getByText(/4 won, 2 lost · 67% overall/)).toBeTruthy();
    expect(screen.getByLabelText("By deal size").textContent).toContain("No amount set");
  });
  it("Sources shows win rate by what was said: a tracker heard on the deal's calls vs not (F20.10)", async () => {
    const closed = [
      ...[1, 2, 3, 4, 5].map((i) => ({ ...P(`w${i}`, `Won ${i}`, "won", 1000), callCount: 2 })),
      ...[1, 2, 3, 4, 5].map((i) => ({ ...P(`l${i}`, `Lost ${i}`, "lost", 1000), callCount: 2 })),
    ];
    const mentions = { w1: ["Pricing"], w2: ["Pricing"], w3: ["Pricing"], w4: ["Pricing"], l1: ["Pricing"] };
    respond({ "/api/coach/remote/prospects/mentions": { mentions }, "/api/coach/remote/prospects": { ...MINE, prospects: [MINE.prospects[0], ...closed] } });
    render(<RemotePipeline />);
    await screen.findByText("Pat Prospect");
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    const t = await screen.findByLabelText("By what was said");
    expect(t.textContent).toContain("Pricing");
    expect(t.textContent).toContain("4–1 · 80%"); // mentioned: 4 won, 1 lost
    expect(t.textContent).toContain("1–4 · 20%"); // not mentioned
  });
});

