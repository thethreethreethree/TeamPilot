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
        q.in = (_c: string, ids: string[]) => ({ then: (res: (v: unknown) => unknown) => res({ data: ids.filter((i) => i !== "s3").map((session_id) => ({ session_id })).filter((r) => r.session_id !== "s1"), error: null }) });
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
    const admin = { from: () => ({ select: () => ({ in: () => ({ then: (res: (v: unknown) => unknown) => res({ data: null, error: { message: "boom" } }) }) }) }) };
    await expect(hiddenFrom(admin as never, ["s1"], "mgr")).rejects.toThrow("hidden check failed");
  });
});
