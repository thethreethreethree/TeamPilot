// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/** Your own pipeline lists the deals you co-own (0395), with your share; one opens read only. */
const nav = vi.hoisted(() => ({ q: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams(nav.q) }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
import { RemotePipeline } from "../RemotePipeline";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const CO = { id: "c9", repId: "other", name: "Globex", organization: null, status: "open", stageLabel: null, source: null, amount: 1000, nextCallDate: null, nextCallTime: null, lastCallAt: null, callCount: 0, createdAt: "2026-11-20T00:00:00Z", openTodos: 0, nextTodo: null, sentiment: null, split: [{ userId: "me", pct: 30 }, { userId: "other", pct: 70 }] };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.q = "";
});

describe("deals you co-own", () => {
  it("are listed with your share, and open read only", async () => {
    nav.q = "p=c9";
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.startsWith("/api/coach/remote/prospects/c9")) return json({ prospect: { id: "c9", rep_id: "other", name: "Globex", organization: null, status: "open", stage_label: null, amount: 1000, next_call_date: null }, calls: [], todos: [], readOnly: true, split: CO.split, splitFailed: false });
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [], coOwned: [CO], totals: { open: { count: 0, amount: 0 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "me" });
      return json({});
    }));
    render(<RemotePipeline />);
    const box = await screen.findByRole("region", { name: "Deals you co-own" });
    expect(box.textContent).toMatch(/Globex.*your share 30%/);
    expect(await screen.findByText(/You co-own this deal: you can read it/)).toBeTruthy();
    // read only (review 2026-11-28): no AI tabs that would refuse, every control disabled rather than refused
    expect(screen.queryByRole("tab", { name: "Brief" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Playbook" })).toBeNull();
    // a disabled fieldset disables its controls (the :disabled state), not each control's own attribute
    expect((screen.getByLabelText("Next call date") as HTMLInputElement).matches(":disabled")).toBe(true);
  });
});
