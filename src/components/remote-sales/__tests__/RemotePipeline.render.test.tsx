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
});
