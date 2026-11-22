// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/finance/FinanceNav", () => ({ default: () => null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

import TaxPage from "@/app/dashboard/finance/tax/page";

/**
 * 2026-11-23. Ten finance pages decide "Finance isn't set up yet" from an EMPTY Chart of Accounts — and the accounts
 * route answered a database error with `{ accounts: [] }`, while the pages read `a.accounts ?? []`. A failed read told
 * the admin to initialize finance. Now: the route returns 500, accountsFrom throws, and the page says it couldn't load;
 * a genuinely empty Chart of Accounts still says "not set up". (Tax stands for all ten — same three edits each.)
 */
const fetchMock = vi.fn();
const respond = (accounts: unknown) =>
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/api/finance/accounts") ? { ok: accounts !== "FAIL", json: async () => (accounts === "FAIL" ? { error: "Could not load the Chart of Accounts." } : { accounts }) } : { ok: true, json: async () => ({ taxCodes: [] }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("finance page and its Chart of Accounts", () => {
  it("a failed accounts read says it couldn't load — not 'isn't set up yet'", async () => {
    respond("FAIL");
    render(<TaxPage />);
    expect(await screen.findByText(/couldn.t load tax/i)).toBeTruthy();
    expect(screen.queryByText(/isn.t set up yet/i)).toBeNull();
  });

  it("a genuinely empty Chart of Accounts still says 'isn't set up yet'", async () => {
    respond([]);
    render(<TaxPage />);
    expect(await screen.findByText(/isn.t set up yet/i)).toBeTruthy();
  });
});
