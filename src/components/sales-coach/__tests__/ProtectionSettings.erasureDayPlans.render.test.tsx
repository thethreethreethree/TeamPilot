// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import { ProtectionSettings } from "../ProtectionSettings";

/** Settings → Protection → erasure (0322): reps' day plans that mention the customer are listed (rep + day, no words)
 *  and sent with the erase, even when the customer is on no call. */
const fetchMock = vi.fn();
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const posts: Array<Record<string, unknown>> = [];
beforeEach(() => {
  posts.length = 0;
  vi.clearAllMocks();
  fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
    if (String(url).endsWith("/remote/erasure") && init?.method === "POST") {
      const b = JSON.parse(init.body!) as Record<string, unknown>;
      posts.push(b);
      if (b.action === "find") return json({ hint: "client B•••", capped: false, matches: [], dayPlans: [{ id: 7, repName: "Dana Rep", day: "2026-11-20" }] });
      return json({ erased: 0, plansErased: 1, hint: "client B•••" });
    }
    if (String(url).includes("/settings/retention")) return json({ isDefault: true, defaultKeep: 20, defaultDays: 90, min: 1, max: 1000, canManage: true, keepLastPerRep: null });
    if (String(url).includes("/audit")) return json({ rows: [], more: false });
    if (String(url).includes("/erasure")) return json({ unfinished: [] });
    if (String(url).includes("/vocabulary")) return json({ terms: [], canManage: false });
    if (String(url).includes("/webhooks")) return json({ endpoints: [], canManage: false });
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("erasure and day plans", () => {
  it("a customer only in a day plan: listed by rep and day, and erased", async () => {
    render(<ProtectionSettings />);
    const input = await screen.findByPlaceholderText("(555) 010-0123");
    fireEvent.change(input, { target: { value: "Betty Ross" } });
    fireEvent.click(screen.getByRole("button", { name: "Find calls" }));
    expect(await screen.findByText(/1 rep day plan mention client B/)).toBeTruthy();
    expect(screen.getByText(/Dana Rep.s day plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Erase 1 selected…" }));
    fireEvent.click(screen.getByRole("button", { name: "Erase 1" }));
    await waitFor(() => expect(posts.at(-1)).toMatchObject({ action: "erase", sessionIds: [], dayPlanIds: [7] }));
    expect(await screen.findByText(/removed them from 1 day plan/)).toBeTruthy();
  });
});
