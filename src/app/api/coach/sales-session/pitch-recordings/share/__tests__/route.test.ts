import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST pitch-recordings/share, the manager's "ask to save as a team example" path — 0337 (F33.8): a call a company
 *  phrase hid from the manager can't be asked about; a failed hide check writes nothing. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "m1", companyId: "co1", isAdmin: false })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/coach/recordings/notifyRecording", () => ({ notifyRecordingEvent: vi.fn(async () => true) }));
const db = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; row: unknown }>, hidden: false, hideReadFails: false }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string) => ({ data: fn === "rss_call_hidden_for" ? db.hidden : null, error: null }),
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: table === "pitch_scores" ? { id: "p1", company_id: "co1", rep_id: "rep1", session_id: "s1" } : null, error: null });
      b.then = (res: (v: unknown) => unknown) =>
        res(table === "call_hides" && db.hideReadFails ? { data: null, error: { message: "boom" } } : { data: table === "call_hides" && db.hidden ? [{ session_id: "s1" }] : [], error: null });
      b.insert = (row: unknown) => {
        db.inserts.push({ table, row });
        const r: Record<string, unknown> = { select: () => r, maybeSingle: async () => ({ data: { id: "e1" }, error: null }) };
        r.then = (res: (v: unknown) => unknown) => res({ error: null });
        return r;
      };
      return b;
    },
  }),
}));
import { POST } from "../route";

const ask = () => POST(new Request("http://x", { method: "POST", body: JSON.stringify({ pitchId: "p1", kind: "requested" }) }) as never);
beforeEach(() => {
  db.inserts = [];
  db.hidden = false;
  db.hideReadFails = false;
});

describe("share request on a hidden call (0337)", () => {
  it("a visible call: the request is written", async () => {
    expect((await ask()).status).toBe(200);
    expect(db.inserts.map((i) => i.table)).toContain("recording_share_events");
  });
  it("a call hidden from this manager: 404, nothing written", async () => {
    db.hidden = true;
    expect((await ask()).status).toBe(404);
    expect(db.inserts).toEqual([]);
  });
  it("a failed hide check: 500, nothing written", async () => {
    db.hideReadFails = true;
    expect((await ask()).status).toBe(500);
    expect(db.inserts).toEqual([]);
  });
});
