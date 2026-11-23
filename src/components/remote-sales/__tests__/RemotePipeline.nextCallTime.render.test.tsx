// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** A time on the next call (0325): date and time are one fact — changing either sends both; the row shows the time. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams("p=p1") }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
import { RemotePipeline } from "../RemotePipeline";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const PROSPECT = { id: "p1", repId: "r", name: "Acme", organization: null, status: "open", stageLabel: null, source: null, amount: 100, nextCallDate: "2026-12-01", nextCallTime: "15:30", lastCallAt: null, callCount: 0, createdAt: "2026-11-01T00:00:00Z", openTodos: 0, nextTodo: null, sentiment: null };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("next call time", () => {
  it("the row shows the time; changing the time sends the date with it, changing the date keeps the time", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url.startsWith("/api/coach/remote/prospects/p1") && init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ ok: true });
      }
      if (url.startsWith("/api/coach/remote/prospects/p1")) return json({ prospect: { id: "p1", name: "Acme", organization: null, status: "open", stage_label: null, amount: 100, next_call_date: "2026-12-01", next_call_time: "15:30" }, calls: [], todos: [] });
      if (url.startsWith("/api/coach/remote/prospects")) return json({ prospects: [PROSPECT], totals: { open: { count: 1, amount: 100 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } }, viewerId: "r" });
      return json({});
    }));
    render(<RemotePipeline />);
    const time = (await screen.findByLabelText("Next call time")) as HTMLInputElement;
    expect(time.value).toBe("15:30");
    expect(screen.getAllByText(/Next call:/)[0]!.textContent).toMatch(/3:30/);
    fireEvent.change(time, { target: { value: "09:00" } });
    fireEvent.blur(time);
    await waitFor(() => expect(posts).toContainEqual({ action: "set", kind: "next_call", value: { date: "2026-12-01", time: "09:00" } }));
    fireEvent.change(screen.getByLabelText("Next call date"), { target: { value: "2026-12-03" } });
    await waitFor(() => expect(posts).toContainEqual({ action: "set", kind: "next_call", value: { date: "2026-12-03", time: "09:00" } }));
  });
});
