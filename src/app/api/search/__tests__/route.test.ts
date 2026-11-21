import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/coach/remote/search", () => ({ runCallSearch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "is", "or", "order", "limit", "ilike", "eq"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
      return b;
    },
  })),
}));

import { runCallSearch } from "@/lib/coach/remote/search";
import { GET } from "../route";

const req = (q: string) => ({ nextUrl: new URL(`http://x/api/search?q=${encodeURIComponent(q)}`) }) as never;

beforeEach(() => vi.clearAllMocks());

describe("GET /api/search — sales calls (RSS Phase 5, F12.4)", () => {
  it("includes calls matched on what was said, through runCallSearch, two hits each", async () => {
    vi.mocked(runCallSearch).mockResolvedValue({
      ok: true,
      truncated: false,
      rows: [{
        sessionId: "s1", repId: "r1", repName: "Rae", channel: "phone", callLabel: "Acme", startedAt: "2026-11-20T10:00:00Z", outcome: null, score: null,
        hits: [1, 2, 3].map((seq) => ({ seq, speaker: "customer", text: `price ${seq}`, atMs: seq * 1000 })),
      }],
    });
    const j = await (await GET(req("price"))).json();
    expect(runCallSearch).toHaveBeenCalledWith(expect.anything(), { q: "price" });
    expect(j.salesCalls).toEqual([{ sessionId: "s1", callLabel: "Acme", channel: "phone", startedAt: "2026-11-20T10:00:00Z", repName: "Rae", hits: [
      { seq: 1, speaker: "customer", text: "price 1", atMs: 1000 }, { seq: 2, speaker: "customer", text: "price 2", atMs: 2000 },
    ] }]);
    expect(j.salesCallsFailed).toBe(false);
  });
  it("a failed call search is flagged, never shown as 'no calls'", async () => {
    vi.mocked(runCallSearch).mockResolvedValue({ ok: false, status: 500, error: "The transcript search failed." });
    const j = await (await GET(req("price"))).json();
    expect(j.salesCalls).toEqual([]);
    expect(j.salesCallsFailed).toBe(true);
  });
  it("an empty query returns the empty shape, with no call search", async () => {
    const j = await (await GET(req("  "))).json();
    expect(j).toEqual({ files: [], chatMessages: [], supportMessages: [], salesCalls: [] });
    expect(runCallSearch).not.toHaveBeenCalled();
  });
});
