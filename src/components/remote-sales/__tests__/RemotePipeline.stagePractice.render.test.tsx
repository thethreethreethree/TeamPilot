// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Training by deal stage on the prospect card (0310): the rep starts the stage's practice; a manager only reads. */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), useSearchParams: () => new URLSearchParams("p=p1") }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));

import { RemotePipeline } from "../RemotePipeline";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const PROSPECT = { id: "p1", repId: "r", name: "Acme", organization: null, status: "open", stageLabel: "Demo", source: null, amount: 100, nextCallDate: null, lastCallAt: null, callCount: 0, createdAt: "2026-11-01T00:00:00Z", openTodos: 0, nextTodo: null, sentiment: null };
function stub(canStart: boolean) {
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
    if (url.includes("stage-practice") && init?.method === "POST") {
      posts.push(JSON.parse(init.body!));
      return json({ assignmentId: "a9", started: true });
    }
    if (url.includes("stage-practice")) return json({ stage: "Demo", canStart, scenarios: [{ id: "sc1", title: "Demo opener", focus: "Set the agenda", difficulty: "easy", lengthMin: 5, assignmentId: null }] });
    if (url.startsWith("/api/coach/remote/prospects/p1")) return json({ prospect: { id: "p1", name: "Acme", organization: null, status: "open", stage_label: "Demo", amount: 100, next_call_date: null }, calls: [], todos: [] });
    if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [PROSPECT], totals: { open: { count: 1, amount: 100 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
    return json({});
  }));
  return posts;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});

describe("Stage practice on the prospect card", () => {
  it("the rep starts the stage's practice and goes straight into it", async () => {
    const posts = stub(true);
    render(<RemotePipeline />);
    expect(await screen.findByText(/Practice for “Demo”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/remote-sales/practice?assignment=a9"));
    expect(posts).toEqual([{ prospectId: "p1", scenarioId: "sc1" }]);
  });
  it("someone who can't start it (a manager on a report's prospect) sees the list, no button", async () => {
    stub(false);
    render(<RemotePipeline />);
    expect(await screen.findByText("Demo opener")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Practice" })).toBeNull();
  });
});
