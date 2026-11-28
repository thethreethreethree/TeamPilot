import { describe, it, expect } from "vitest";
import { rankSuggestions, recommendedContacts } from "../recommendedContacts";
import type { Rank } from "../rank";

/** Recommended contacts (F26.6). Pinned: only the account's people heard on its calls and not on the deal; senior first, then calls; a call the reader can't open doesn't count; a failed read throws, never "no one". */
const c = (id: string, title: string | null, rank: Rank) => ({ id, name: id, title, rank, accountId: "a1", email: null, phone: null });

describe("rankSuggestions", () => {
  it("leaves out the deal's people and people never heard; senior titles first, then more calls", () => {
    const out = rankSuggestions(
      [c("ind", "Analyst", "individual"), c("vp", "VP Ops", "vp"), c("mgr2", "Manager", "manager"), c("mgr5", "Manager", "manager"), c("ondeal", "CEO", "c_level"), c("silent", "CFO", "c_level")],
      new Set(["ondeal"]),
      new Map([["ind", { calls: 9, lastCallAt: "t" }], ["vp", { calls: 1, lastCallAt: "t" }], ["mgr2", { calls: 2, lastCallAt: "t" }], ["mgr5", { calls: 5, lastCallAt: "t" }], ["ondeal", { calls: 4, lastCallAt: "t" }]]),
    );
    expect(out.map((x) => x.id)).toEqual(["vp", "mgr5", "mgr2", "ind"]);
  });
});

const db = (over: Partial<Record<string, unknown[] | "fail">> = {}) => ({
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
    const rows: Record<string, unknown[]> = {
      contacts_current: [c("vp", "VP Ops", "vp"), c("x", "CEO", "c_level")],
      remote_prospects_current: [{ id: "d1" }, { id: "d2" }],
      remote_prospect_calls: [{ session_id: "s1" }, { session_id: "s2" }],
      call_contacts_current: [{ session_id: "s1", contact_id: "vp" }, { session_id: "s2", contact_id: "vp" }, { session_id: "s3", contact_id: "x" }],
      coaching_sessions: [{ id: "s1", started_at: "2026-11-01" }, { id: "s2", started_at: "2026-11-09" }], // s3 isn't visible
    };
    const v = over[table];
    q.then = (r: (v: unknown) => unknown) => r(v === "fail" ? { data: null, error: { message: "boom" } } : { data: v ?? rows[table] ?? [], error: null });
    return q;
  },
}) as never;

describe("recommendedContacts", () => {
  it("counts only calls the reader can open, with the latest one", async () => {
    expect(await recommendedContacts(db(), "a1", new Set())).toEqual([expect.objectContaining({ id: "vp", calls: 2, lastCallAt: "2026-11-09" })]);
  });
  it("a failed read throws rather than suggesting no one", async () => {
    await expect(recommendedContacts(db({ call_contacts_current: "fail" }), "a1", new Set())).rejects.toThrow();
  });
});
