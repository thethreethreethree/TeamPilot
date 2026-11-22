import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/search/export — call search as CSV, managers only (2026-11-23). Pinned: a rep is refused; the
 * search is phone/video only, through the caller's client; the audit row records the filters and the count, never the
 * rows; a cell that starts like a formula is neutralised in the file (CWE-1236, the real CSV builder).
 */
const st = vi.hoisted(() => ({
  mgr: { userId: "m-1", companyId: "co1" } as null | { userId: string; companyId: string },
  searchArgs: null as unknown,
  rows: [] as unknown[],
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ caller: true }) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => st.mgr) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/remote/search", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    parseCallSearch: () => ({ filters: { q: "price" } }),
    runCallSearch: vi.fn(async (db: unknown, args: unknown) => ((st.searchArgs = { db, args }), { ok: true, rows: st.rows, truncated: false })),
  };
});

import { recordAudit } from "@/lib/audit/recordAudit";
import { GET } from "../route";

const get = () => GET(new Request("http://x/api?q=price") as never);
const ROW = {
  sessionId: "s1", startedAt: "2026-11-20", repName: "Pat Rep", channel: "phone", callLabel: "=HYPERLINK(\"http://evil\")",
  outcome: "sold", score: 71, hits: [{ text: "it's too pricey" }],
};

beforeEach(() => {
  st.mgr = { userId: "m-1", companyId: "co1" };
  st.searchArgs = null;
  st.rows = [ROW];
  vi.mocked(recordAudit).mockClear();
});

describe("call search export", () => {
  it("a rep is refused, and nothing is searched or audited", async () => {
    st.mgr = null;
    expect((await get()).status).toBe(403);
    expect(st.searchArgs).toBeNull();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("searches phone/video calls only, as the caller", async () => {
    await get();
    expect(st.searchArgs).toEqual({ db: { caller: true }, args: { q: "price", remoteOnly: true } });
  });

  it("audits the filters and the count — never the rows", async () => {
    await get();
    const meta = vi.mocked(recordAudit).mock.calls[0]![1].meta as Record<string, unknown>;
    expect(meta).toEqual({ filters: { q: "price" }, rows: 1, truncated: false });
    expect(JSON.stringify(meta)).not.toContain("pricey");
  });

  it("returns a CSV download whose formula-like cell is neutralised", async () => {
    const res = await get();
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="calls-\d{4}-\d{2}-\d{2}\.csv"/);
    const csv = await res.text();
    expect(csv).toContain("Pat Rep");
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
    // …and it is still there, neutralised, rather than dropped.
    expect(csv).toMatch(/'=HYPERLINK/);
  });
});
