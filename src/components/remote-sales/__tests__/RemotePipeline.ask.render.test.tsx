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

  it("a follow-up sends the earlier turn back; the thread shows both; New conversation clears it", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url.includes("ask-pipeline") && init?.method === "POST") {
        const b = JSON.parse(init.body!) as Record<string, unknown>;
        bodies.push(b);
        return json({ answer: bodies.length === 1 ? "Openco has no next call [P1]." : "Book Openco for Tuesday.", citations: [{ ref: 1, prospectId: "o1", name: "Openco" }], prospects: 1, capped: false });
      }
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [P("o1", "Openco", "open")], totals: { open: { count: 1, amount: 100 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
      return json({});
    }));
    render(<RemotePipeline />);
    await screen.findAllByText("Openco");
    fireEvent.change(screen.getByLabelText("Question about this pipeline"), { target: { value: "Which deals stall?" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
    await screen.findByText("Which deals stall?");
    fireEvent.change(screen.getByLabelText("Question about this pipeline"), { target: { value: "What should I do?" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
    expect(await screen.findByText("Book Openco for Tuesday.")).toBeTruthy();
    expect(bodies[0]!.history).toEqual([]);
    expect(bodies[1]!.history).toEqual([{ question: "Which deals stall?", answer: "Openco has no next call [P1]." }]);
    expect(screen.getByText(/This conversation isn.t saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByText("Which deals stall?")).toBeNull();
  });
});

