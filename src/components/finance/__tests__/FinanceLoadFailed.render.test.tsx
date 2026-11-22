// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/finance/FinanceNav", () => ({ default: () => null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

import CardsPage from "@/app/dashboard/finance/cards/page";

/**
 * 2026-11-23. Fifteen finance sub-pages showed "Finance isn't set up yet — initialize the Chart of Accounts" from
 * `load().catch(...)`, i.e. on ANY failed load; none checks for an empty Chart of Accounts. A failed load now shows
 * "Couldn't load …". Pinned two ways: the cards page renders it on a thrown load, and no finance page wires
 * FinanceNotSetUp to a failed load again.
 */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("a finance page whose load fails", () => {
  it("says it couldn't load — not 'Finance isn't set up yet'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<CardsPage />);
    expect(await screen.findByText(/couldn.t load corporate cards/i)).toBeTruthy();
    expect(screen.queryByText(/isn.t set up yet/i)).toBeNull();
  });

  it("no finance page shows FinanceNotSetUp from a failed load", () => {
    const root = join(process.cwd(), "src/app/dashboard/finance");
    const offenders: string[] = [];
    for (const dir of readdirSync(root)) {
      const f = join(root, dir, "page.tsx");
      if (!existsSync(f)) continue;
      const s = readFileSync(f, "utf8");
      if (/\.catch\(\(\) => setReady\(false\)\)/.test(s) && /ready === false\) return <FinanceNotSetUp/.test(s)) offenders.push(dir);
    }
    expect(offenders).toEqual([]);
  });
});
