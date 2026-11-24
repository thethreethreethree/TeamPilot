// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * "KEEP IT SIMPLE" (General Sales Interface PDF; founder picker 2026-11-24 "Macro Mode = PDF only"): a rep in Macro Mode
 * sees Open / Closed Won / Closed Lost and, per prospect, to-do, stage, next call, last call, amount — nothing else.
 * Since 2026-11-25 (founder picker "PDF screens + team section") a manager gets the same screen plus "Whose pipeline";
 * Macro Mode off shows everything. The prospects are a table, one column per field, like the PDF's picture.
 */
const st = vi.hoisted(() => ({ macro: true as boolean | null, manager: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/hooks/useRemoteMacroMode", () => ({ useRemoteMacroMode: () => ({ enabled: st.macro }) }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => st.manager, useCurrentUserRole: () => (st.manager ? "CEO" : "Member"), isCompanyAdminRole: () => false }));
import { RemotePipeline } from "../RemotePipeline";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const P = { id: "p1", repId: "r", name: "Acme", organization: null, status: "open", stageLabel: "Demo", source: "Webinar", amount: 900, nextCallDate: "2026-12-01", closeDate: "2026-12-20", lastCallAt: "2026-11-20T10:00:00Z", callCount: 1, createdAt: "2026-11-01T00:00:00Z", openTodos: 1, nextTodo: { id: "t", title: "Send Betty the follow-up", due: null }, sentiment: { last: "cooling", trend: null, calls: 1 } };
const stub = () =>
  vi.stubGlobal("fetch", vi.fn((url: string) => (url.startsWith("/api/coach/remote/prospects") ? json({ prospects: [P], totals: { open: { count: 1, amount: 900 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" }) : json({ members: [] }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  st.macro = true;
  st.manager = false;
});

describe("pipeline in Macro Mode", () => {
  it("a rep sees the PDF's pipeline only: tabs, to-do, stage, next call, last call, amount", async () => {
    stub();
    render(<RemotePipeline />);
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Closed Won/ })).toBeTruthy();
    expect(screen.getByText(/Send Betty the follow-up/)).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Prospect", "To do", "Stage", "Next call", "Last call", "Amount"]);
    expect(screen.getByText("Demo")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Whose pipeline" })).toBeNull();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull(); // no Calendar / Sources / Forecast
    expect(screen.queryByRole("region", { name: "Ask about this pipeline" })).toBeNull();
    expect(screen.queryByText(/Close:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /New prospect/ }));
    expect(screen.queryByLabelText("Lead source")).toBeNull();
  });
  it("a manager in Macro Mode gets the same PDF screen plus the team section (Whose pipeline)", async () => {
    st.manager = true;
    stub();
    render(<RemotePipeline />);
    await screen.findByText("Acme");
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.queryByText(/Close:/)).toBeNull();
    expect(screen.getByRole("combobox", { name: "Whose pipeline" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  });

  it("with Macro Mode off, anyone keeps the full view", async () => {
    st.manager = false;
    st.macro = false;
    stub();
    render(<RemotePipeline />);
    await screen.findByText("Acme");
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(screen.getByText(/Close:/)).toBeTruthy();
  });
});
