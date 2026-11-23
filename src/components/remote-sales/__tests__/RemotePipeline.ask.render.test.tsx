// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * The Ask box on the Pipeline (2026-11-23): an answer's prospect citation must open that prospect on the tab that
 * holds it — a Closed Won prospect used to "open" on the Open tab, i.e. invisibly (fixed by goTo).
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));

import { RemotePipeline } from "../RemotePipeline";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const P = (id: string, name: string, status: "open" | "won" | "lost") => ({
  id, repId: "r", name, organization: null, status, stageLabel: null, source: null, amount: 100, nextCallDate: null, lastCallAt: null,
  callCount: 0, createdAt: "2026-11-01T00:00:00Z", openTodos: 0, nextTodo: null, sentiment: null,
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("RemotePipeline Ask box", () => {
  it("a cited closed-won prospect opens on the Closed Won tab", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string }) => {
      if (url.includes("ask-pipeline") && init?.method === "POST") return json({ answer: "Wonco closed fast [P1].", citations: [{ ref: 1, prospectId: "w1", name: "Wonco" }], prospects: 2, capped: false });
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [P("o1", "Openco", "open"), P("w1", "Wonco", "won")], totals: { open: { count: 1, amount: 100 }, won: { count: 1, amount: 100 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
      return json({});
    }));
    render(<RemotePipeline />);
    expect(await screen.findByText("Openco")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Question about this pipeline"), { target: { value: "What closed?" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Wonco" }));
    expect(screen.getByRole("tab", { name: /Closed Won/ }).getAttribute("aria-selected")).toBe("true");
    expect(replace).toHaveBeenCalledWith("/dashboard/remote-sales/pipeline?p=w1", { scroll: false });
  });
});
