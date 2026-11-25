import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  },
}));
import { matchHidePhrases, scanCallForHidePhrases } from "../hidePhrases";

describe("scanCallForHidePhrases never throws (it runs inside call processing)", () => {
  it("no service-role client → null, not a rejection", async () => {
    await expect(scanCallForHidePhrases(null, "s1")).resolves.toBeNull();
  });
  it("a failed session read → null (unknown), not [] (checked, nothing matched)", async () => {
    const q: Record<string, unknown> = {};
    for (const m of ["from", "select", "eq"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: null, error: { message: "boom" } });
    await expect(scanCallForHidePhrases(q as never, "s1")).resolves.toBeNull();
  });
});

describe("matchHidePhrases (0337)", () => {
  const P = [{ id: "p1", phrase: "personal call" }, { id: "p2", phrase: "off the record" }];
  it("finds a phrase in any case and spacing, as whole words", () => {
    expect(matchHidePhrases("Sorry, this is a  PERSONAL\ncall for a sec", P).map((p) => p.id)).toEqual(["p1"]);
  });
  it("doesn't match inside other words", () => {
    expect(matchHidePhrases("our impersonal calling plan", P)).toEqual([]);
  });
  it("several phrases can match", () => {
    expect(matchHidePhrases("personal call, and off the record", P).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("hiddenCallsForCompany (0337)", () => {
  const client = (rows: Record<string, unknown[]>) => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown) => res({ data: rows[t] ?? [], error: null });
      q.range = async (f: number) => ({ data: f > 0 ? [] : rows[t] ?? [], error: null });
      return q;
    },
  });
  it("one row per call with every active phrase; an unhidden hide drops out", async () => {
    const { hiddenCallsForCompany } = await import("../hidePhrases");
    const out = await hiddenCallsForCompany(
      client({
        call_hides: [
          { id: "h1", session_id: "s1", phrase: "personal call", created_at: "2026-11-25T10:00:00Z" },
          { id: "h2", session_id: "s1", phrase: "off the record", created_at: "2026-11-25T09:00:00Z" },
          { id: "h3", session_id: "s2", phrase: "personal call", created_at: "2026-11-24T09:00:00Z" },
        ],
        call_unhides: [{ hide_id: "h3" }],
        coaching_sessions: [{ id: "s1", client_label: "Acme", started_at: "2026-11-25T08:00:00Z", agent_id: "rep1" }],
      }) as never,
      "co1",
    );
    expect(out).toEqual([{ sessionId: "s1", phrases: ["personal call", "off the record"], hiddenAt: "2026-11-25T10:00:00Z", label: "Acme", startedAt: "2026-11-25T08:00:00Z", repId: "rep1" }]);
  });
});

describe("hiddenFrom (0337)", () => {
  it("asks the SQL rule only about calls that have a hide row, and returns its verdicts", async () => {
    const { hiddenFrom } = await import("../hidePhrases");
    const asked: string[] = [];
    const admin = {
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.in = (_c: string, ids: string[]) => {
          const page = { data: ids.filter((i) => i !== "s3").map((session_id) => ({ session_id })).filter((r) => r.session_id !== "s1"), error: null };
          const o: Record<string, unknown> = { order: () => o, range: async (f: number) => (f > 0 ? { data: [], error: null } : page) };
          return o;
        };
        return q;
      },
      rpc: async (_f: string, a: { p_session: string }) => (asked.push(a.p_session), { data: a.p_session === "s2", error: null }),
    };
    // s1 and s3 have no hide row; s2 (hidden from this viewer) and s4 (a hide the viewer may see past) do.
    const out = await hiddenFrom(admin as never, ["s1", "s2", "s3", "s4", "s2"], "mgr");
    expect(asked.sort()).toEqual(["s2", "s4"]);
    expect([...out]).toEqual(["s2"]);
  });
  it("a failed read throws — a route must not show a call it couldn't confirm is visible", async () => {
    const { hiddenFrom } = await import("../hidePhrases");
    const fail = { data: null, error: { message: "boom" } };
    const o: Record<string, unknown> = { order: () => o, range: async () => fail };
    const admin = { from: () => ({ select: () => ({ in: () => o }) }) };
    await expect(hiddenFrom(admin as never, ["s1"], "mgr")).rejects.toThrow("hidden check failed");
  });
});

describe("review 2026-11-26: reads are paged", () => {
  it("a phrase said after the 1000th line still hides the call", async () => {
    const { scanCallForHidePhrases } = await import("../hidePhrases");
    const lines = Array.from({ length: 1200 }, (_, i) => ({ text: i === 1150 ? "this is a personal call" : `line ${i}`, seq: i }));
    const inserts: unknown[] = [];
    const admin = {
      from: (t: string) => {
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in", "order"]) q[m] = () => q;
        q.maybeSingle = async () => ({ data: { company_id: "co1", context: "phone" }, error: null });
        q.range = async (f: number, to: number) => ({ data: t === "coaching_transcript_segments_current" ? lines.slice(f, to + 1) : [], error: null });
        q.insert = async (row: unknown) => (inserts.push(row), { error: null });
        return q;
      },
    };
    expect(await scanCallForHidePhrases(admin as never, "s1", [{ id: "p1", phrase: "personal call" }])).toEqual(["personal call"]);
    expect(inserts).toHaveLength(1);
  });
  it("the company-wide check is one paged database call, not one per hidden call", async () => {
    const { hiddenInCompanyFrom } = await import("../hidePhrases");
    const rpcs: Array<[string, unknown]> = [];
    const admin = { rpc: (fn: string, args: unknown) => (rpcs.push([fn, args]), { range: async (f: number) => ({ data: f > 0 ? [] : ["s1", "s2"], error: null }) }) };
    expect([...(await hiddenInCompanyFrom(admin as never, "co1", "mgr"))].sort()).toEqual(["s1", "s2"]);
    expect(rpcs).toEqual([["rss_hidden_calls_for", { p_company: "co1", p_viewer: "mgr" }]]);
  });
});
