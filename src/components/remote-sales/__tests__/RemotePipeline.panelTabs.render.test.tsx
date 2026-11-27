// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * The deal panel's tabs (revenue UI spec: Overview · Warnings · Contacts · Activity · Playbook · Brief). Pinned: it
 * opens on Overview; Warnings lists each warning with what to do about it; Activity holds the calls.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams("p=p1") }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
import { RemotePipeline } from "../RemotePipeline";
import { RISK_FIX } from "@/lib/coach/remote/dealRisk";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
// No next call and no amount: two warnings with fixes.
const PROSPECT = { id: "p1", repId: "r", name: "Acme", organization: null, status: "open", stageLabel: null, source: null, amount: null, nextCallDate: null, nextCallTime: null, lastCallAt: null, callCount: 0, createdAt: "2026-11-20T00:00:00Z", openTodos: 0, nextTodo: null, sentiment: null };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("deal panel tabs", () => {
  it("opens on Overview; Warnings shows each warning with its fix; Activity holds the calls", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.startsWith("/api/coach/remote/prospects/p1")) return json({ prospect: { id: "p1", name: "Acme", organization: null, status: "open", stage_label: null, amount: null, next_call_date: null }, calls: [], todos: [] });
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [PROSPECT], totals: { open: { count: 1, amount: 0 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
      return json({});
    }));
    render(<RemotePipeline />);
    const overview = await screen.findByRole("tab", { name: "Overview" });
    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Next call date")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Warnings \(2\)/ }));
    expect(screen.getByText(RISK_FIX.no_next_call)).toBeTruthy();
    expect(screen.getByText(RISK_FIX.no_amount)).toBeTruthy();
    expect(screen.queryByLabelText("Next call date")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText(/No calls linked yet/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Deal changes" })).toBeNull(); // no history → no Changes list
  });
  it("Activity lists the deal's changes (F23.11): from → to, who; none recorded shows no Changes list", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.startsWith("/api/coach/remote/prospects/p1")) return json({
        prospect: { id: "p1", name: "Acme", organization: null, status: "open", stage_label: null, amount: 5000, next_call_date: null },
        calls: [], todos: [],
        history: [
          { kind: "amount", value: { amount: 5000 }, actor_id: "u1", created_at: "2026-11-26T10:00:00Z" },
          { kind: "amount", value: { amount: 3000 }, actor_id: "u2", created_at: "2026-11-24T10:00:00Z" },
        ],
        actors: { u1: "Ana" },
      });
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [PROSPECT], totals: { open: { count: 1, amount: 0 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
      return json({});
    }));
    render(<RemotePipeline />);
    fireEvent.click(await screen.findByRole("tab", { name: "Activity" }));
    const list = screen.getByRole("list", { name: "Deal changes" });
    expect(list.textContent).toMatch(/Amount\s*\$3,000 → \$5,000 · Ana/);
    expect(list.textContent).toMatch(/set to \$3,000 · A teammate/);
  });
});
