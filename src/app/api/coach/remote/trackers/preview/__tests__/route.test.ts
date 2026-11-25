import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/remote/trackers/preview (F11.4). Managers only, and the calls checked are the ones the CALLER may
 * see: the route reads through the caller's client (coaching_sessions RLS + the tree), never the service role.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => { throw new Error("service role must not be used"); }) }));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers(), nextUrl: { searchParams: new URLSearchParams() } }) as never;

function db() {
  const tables: string[] = [];
  const from = (table: string) => {
    tables.push(table);
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "neq", "order", "limit", "range"]) q[m] = () => q;
    (q as { then: unknown }).then = (res: (v: unknown) => unknown) =>
      Promise.resolve(
        res(
          table === "coaching_sessions"
            ? { data: [{ id: "s1", client_label: "Acme", started_at: "2026-11-20T10:00:00Z", audio_started_at: null, session_kind: "sales" }], error: null }
            : { data: [{ session_id: "s1", speaker: "customer", text: "We use Spectrum today", seq: 1, spoken_at: "2026-11-20T10:00:04Z" }], error: null },
        ),
      );
    return q;
  };
  return { client: { from }, tables };
}

beforeEach(() => vi.clearAllMocks());

describe("tracker preview route", () => {
  it("refuses a non-manager before reading anything", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue(null);
    const { client, tables } = db();
    asMock(createClient).mockResolvedValue(client);
    expect((await POST(req({ phrases: ["spectrum"], side: "any" }))).status).toBe(403);
    expect(tables).toEqual([]);
  });

  it("previews through the caller's own client and stores nothing", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue({ userId: "m1", companyId: "c1" });
    const { client, tables } = db();
    asMock(createClient).mockResolvedValue(client);
    const res = await POST(req({ phrases: ["spectrum"], side: "customer" }));
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview).toMatchObject({ callsChecked: 1, callsWithHits: 1, hitCount: 1 });
    expect(preview.examples[0]).toMatchObject({ sessionId: "s1", atMs: 4000, text: "We use Spectrum today" });
    expect(tables).toEqual(["coaching_sessions", "coaching_transcript_segments_current"]); // reads only, no insert
  });

  it("a phrase list the tracker would refuse is a 400 with the reason", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue({ userId: "m1", companyId: "c1" });
    asMock(createClient).mockResolvedValue(db().client);
    const res = await POST(req({ phrases: ["a"], side: "any" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too short/);
  });
});

describe("tracker preview — sample, dates and a stable read (26 Nov)", () => {
  it("checks up to 100 calls, only inside the tracker's dates, reading transcripts in call-then-line order", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue({ userId: "m1", companyId: "co1" });
    const calls: Array<[string, string, unknown]> = [];
    const from = (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "neq", "range"]) q[m] = () => q;
      for (const m of ["order", "limit", "gte", "lt"]) q[m] = (a: unknown, b?: unknown) => (calls.push([table, m, m === "order" ? a : m === "limit" ? a : [a, b]]), q);
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) =>
        Promise.resolve(res(table === "coaching_sessions" ? { data: [{ id: "s1", client_label: "Acme", started_at: "2026-12-05T10:00:00Z", audio_started_at: null, session_kind: "sales" }], error: null } : { data: [], error: null }));
      return q;
    };
    asMock(createClient).mockResolvedValue({ from });
    const res = await POST(req({ phrases: ["promo"], side: "any", startsOn: "2026-12-01", endsOn: "2026-12-31" }));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(["coaching_sessions", "limit", 100]);
    expect(calls).toContainEqual(["coaching_sessions", "gte", ["started_at", "2026-12-01T00:00:00Z"]]);
    expect(calls).toContainEqual(["coaching_sessions", "lt", ["started_at", "2027-01-01T00:00:00.000Z"]]);
    const segOrder = calls.filter(([t, m]) => t === "coaching_transcript_segments_current" && m === "order").map(([, , a]) => a);
    expect(segOrder).toEqual(["session_id", "seq"]);
  });
});
