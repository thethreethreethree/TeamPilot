import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonSalesSubjects, subjectsNotIn, NON_SALES_KINDS } from "../nonSalesSubjects";
import { isSalesCall } from "../salesOnly";

/** A fake admin client: records the filters applied and answers with the given rows or error. */
function fakeAdmin(rows: { id: string }[] | null, error: unknown = null) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "in", "eq"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error });
  return { admin: chain as unknown as SupabaseClient, calls };
}

describe("nonSalesSubjects", () => {
  it("asks for exactly the kinds isSalesCall treats as not a sales call", async () => {
    for (const k of NON_SALES_KINDS) expect(isSalesCall(k)).toBe(false);
    expect(isSalesCall("sales")).toBe(true);
    const { admin, calls } = fakeAdmin([]);
    await nonSalesSubjects(admin, { companyId: "co1" });
    expect(calls).toContainEqual({ method: "in", args: ["session_kind", ["meeting", "huddle"]] });
  });

  it("scopes to the company or to the rep", async () => {
    const a = fakeAdmin([]);
    await nonSalesSubjects(a.admin, { companyId: "co1" });
    expect(a.calls).toContainEqual({ method: "eq", args: ["company_id", "co1"] });
    const b = fakeAdmin([]);
    await nonSalesSubjects(b.admin, { agentId: "rep1" });
    expect(b.calls).toContainEqual({ method: "eq", args: ["agent_id", "rep1"] });
  });

  it("returns the event subjects of those sessions", async () => {
    const { admin } = fakeAdmin([{ id: "m1" }, { id: "h1" }]);
    expect(await nonSalesSubjects(admin, { agentId: "rep1" })).toEqual(["sales_session:m1", "sales_session:h1"]);
  });

  it("a failed read is null, never an empty list that would count everything", async () => {
    const { admin } = fakeAdmin(null, { message: "boom" });
    expect(await nonSalesSubjects(admin, { agentId: "rep1" })).toBeNull();
  });
});

describe("subjectsNotIn", () => {
  it("quotes each subject for PostgREST", () => {
    expect(subjectsNotIn(["sales_session:m1", "sales_session:h1"])).toBe('("sales_session:m1","sales_session:h1")');
  });

  it("is never empty, so the filter is the same with or without meetings", () => {
    expect(subjectsNotIn([])).toBe('("sales_session:none")');
  });
});
