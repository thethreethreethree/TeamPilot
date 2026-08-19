import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MANAGER_ONLY_EVENT_TYPES } from "../route";

/**
 * Drift guard (§2.2 / the "keep in sync" vein): the RQ6 manager-only-event list exists in TWO places — the
 * TS route (MANAGER_ONLY_EVENT_TYPES, the early-400) and the SQL RPC append_schedule_event (0227, the REAL
 * gate). If they drift — a manager-only type added to one but not the other — the RPC either lets a non-admin
 * append it (security hole) or the route 400s a legitimately-appendable type. This test fails on any such
 * drift, forcing both to move together.
 */
describe("RQ6 manager-only event list: route (TS) and RPC (SQL) agree", () => {
  it("the SQL append_schedule_event manager-only list equals MANAGER_ONLY_EVENT_TYPES", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0227_rpc_enforce_manager_only_events.sql"),
      "utf8",
    );
    // Extract the `p_type in ( '...','...' )` list from append_schedule_event (the only p_type-in block).
    const block = /p_type in \(([\s\S]*?)\)/.exec(sql);
    expect(block, "append_schedule_event must have a `p_type in (...)` gate").toBeTruthy();
    const inner = block?.[1] ?? "";
    const sqlTypes = new Set([...inner.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]));

    // Both directions — no type in one set missing from the other.
    const tsSorted = [...MANAGER_ONLY_EVENT_TYPES].sort();
    const sqlSorted = [...sqlTypes].sort();
    expect(sqlSorted).toEqual(tsSorted);
  });
});
