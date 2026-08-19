import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MANAGER_ONLY_EVENT_TYPES } from "../route";

/**
 * Drift guard (§2.2 / the "keep in sync" vein): the RQ6 manager-only-event list now lives in THREE places —
 * the TS route (MANAGER_ONLY_EVENT_TYPES, the early-400), the SQL RPC append_schedule_event (0227, `p_type in
 * (...)`), and the schedule_event INSERT RLS policy (0230, `type not in (...)` — the REAL table-level gate). If
 * any drifts, a manager-only type is either let through for a non-admin (security hole) or wrongly blocked.
 * This test fails on any divergence, forcing all three to move together.
 */
function extractTypes(file: string, re: RegExp): Set<string> {
  const sql = readFileSync(join(process.cwd(), file), "utf8");
  const block = re.exec(sql);
  expect(block, `${file}: expected a manager-only type list`).toBeTruthy();
  return new Set([...(block?.[1] ?? "").matchAll(/'([A-Z_]+)'/g)].map((m) => m[1] ?? ""));
}

describe("RQ6 manager-only event list: route (TS), RPC (SQL) and RLS (SQL) all agree", () => {
  const ts = [...MANAGER_ONLY_EVENT_TYPES].sort();

  it("append_schedule_event RPC list (0227 `p_type in`) equals MANAGER_ONLY_EVENT_TYPES", () => {
    const rpc = [...extractTypes("supabase/migrations/0227_rpc_enforce_manager_only_events.sql", /p_type in \(([\s\S]*?)\)/)].sort();
    expect(rpc).toEqual(ts);
  });

  it("schedule_event INSERT RLS list (0230 `type not in`) equals MANAGER_ONLY_EVENT_TYPES", () => {
    const rls = [...extractTypes("supabase/migrations/0230_schedule_event_rls_rq6_and_manager_reads.sql", /type not in \(([\s\S]*?)\)/)].sort();
    expect(rls).toEqual(ts);
  });
});
