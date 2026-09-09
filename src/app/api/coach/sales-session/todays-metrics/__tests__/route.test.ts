import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * todays-metrics route — the custom date-range parsing (partner meeting 9/2). A valid from/to (YYYY-MM-DD, from<=to)
 * becomes a {from,to} window; anything malformed falls back to the rolling preset rather than reaching the query as
 * junk. getTodaysMetrics + auth are faked; the window it's called with is the logic under test.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
const getMetrics = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/doorlog", () => ({ getTodaysMetrics: getMetrics }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

const req = (qs: string) => ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  });
  getMetrics.mockResolvedValue({ kpi: { doorsKnocked: 0, conversations: 0, sold: 0 }, scores: {}, focus: null, opportunities: [] });
});

describe("GET todays-metrics — window resolution", () => {
  it("a valid from/to becomes a custom {from,to} window; period reported as 'custom'", async () => {
    const res = await GET(req("from=2026-08-01&to=2026-08-31"));
    expect(res.status).toBe(200);
    expect(getMetrics.mock.calls[0]![1]).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    const body = await res.json();
    expect(body).toMatchObject({ period: "custom", range: { from: "2026-08-01", to: "2026-08-31" } });
  });

  it("from > to falls back to the preset period (never a reversed range to the query)", async () => {
    await GET(req("period=week&from=2026-08-31&to=2026-08-01"));
    expect(getMetrics.mock.calls[0]![1]).toBe("week");
  });

  it("a malformed date falls back to the preset", async () => {
    await GET(req("period=month&from=08/01/2026&to=2026-08-31"));
    expect(getMetrics.mock.calls[0]![1]).toBe("month");
  });

  it("no range → the rolling preset (default day)", async () => {
    await GET(req(""));
    expect(getMetrics.mock.calls[0]![1]).toBe("day");
  });

  it("only one of from/to → preset (both required)", async () => {
    await GET(req("period=all_time&from=2026-08-01"));
    expect(getMetrics.mock.calls[0]![1]).toBe("all_time");
  });
});
