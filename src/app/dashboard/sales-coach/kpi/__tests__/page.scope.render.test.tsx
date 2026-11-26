// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * KPI page scope labels (2026-11-26). The page used to call its numbers "Your whole team's results, pooled" whenever the
 * Company button was pressed — but the server pools only for a company admin, so a sales-coach manager who isn't one
 * read their OWN numbers under that line. The label now follows the server's `scope`, the Company switch shows only
 * when the server says the caller may pool, and a picked team narrows the headline cards in the company view (F23.8).
 */
import KpiAnalyticsPage from "../page";

const MGR = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
const json = (body: unknown, ok = true, status = ok ? 200 : 500) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
let canPool = true;
const meUrls: string[] = [];

beforeEach(() => {
  meUrls.length = 0;
  canPool = true;
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/coach/kpi/me")) {
      meUrls.push(url);
      const u = new URL(url, "http://t");
      const pooled = canPool && u.searchParams.get("scope") === "company";
      return json({ sessionCount: 0, minSessions: 5, metrics: {}, sessions: {}, periodDays: null, scope: pooled ? "company" : "self", team: pooled ? u.searchParams.get("team") : null, canPool });
    }
    if (url.startsWith("/api/coach/kpi/team")) return json({ agents: [{ agentId: "r1", name: "Rae", sessionCount: 2, conversionRate: { value: null, sampleSize: 0 }, relianceReduction: { value: null, sampleSize: 0 } }], monthlyQuotaTarget: null });
    if (url.startsWith("/api/coach/remote/teams")) return json({ teams: [{ id: MGR, name: "Max Manager", size: 3 }] });
    return json({}, false);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KPI page — what the headline cards cover", () => {
  it("a company admin sees the pooled line; picking a team narrows the headline cards and says so", async () => {
    render(<KpiAnalyticsPage />);
    expect(await screen.findByText(/the business as a whole, across every rep/)).toBeTruthy();
    const picker = await screen.findByRole("combobox", { name: "Team" });
    await waitFor(() => expect(screen.getByRole("option", { name: /Max Manager/ })).toBeTruthy());
    fireEvent.change(picker, { target: { value: MGR } });
    expect(await screen.findByText(/One team's results, pooled/)).toBeTruthy();
    expect(meUrls.at(-1)).toContain(`team=${MGR}`);
  });

  it("a manager who can't pool never reads their own numbers under the pooled line, and gets no Company switch", async () => {
    canPool = false;
    render(<KpiAnalyticsPage />);
    expect(await screen.findByText(/compared to your own past, never a leaderboard/)).toBeTruthy();
    await waitFor(() => expect(meUrls.length).toBeGreaterThan(1)); // the default-to-company retry has landed
    expect(screen.queryByText(/pooled/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Company" })).toBeNull();
  });

  it("a refused team shows the error, never the whole company's cards under the picker", async () => {
    render(<KpiAnalyticsPage />);
    await screen.findByText(/the business as a whole, across every rep/);
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => (url.startsWith("/api/coach/kpi/me") && url.includes("team=") ? json({ error: "Team not found." }, false, 404) : base(url)));
    const picker = await screen.findByRole("combobox", { name: "Team" });
    await waitFor(() => expect(screen.getByRole("option", { name: /Max Manager/ })).toBeTruthy());
    fireEvent.change(picker, { target: { value: MGR } });
    await waitFor(() => expect(screen.queryByText(/the business as a whole, across every rep/)).toBeNull());
    expect(screen.queryByText(/One team's results, pooled/)).toBeNull();
  });
});

