import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Allowlist-boundary coverage for the founder-monitoring data layer (0214 exemption).
 *
 * The route tests mock this whole module, so the SECURITY-CRITICAL rail — every cross-tenant read
 * funnels through `isCompanyMonitorable` BEFORE any customer data is returned — had no coverage
 * (audit 2026-08-16, finding #2). This pins it against the real logic with a fake admin client:
 * a company OFF the allowlist yields null/[], and `getMonitoredSession` must NOT even query the
 * transcript segments in that case. A future refactor that reordered/dropped the check reddens here.
 */

// A thenable query chain: awaiting it (or calling .maybeSingle()) resolves to { data }.
function chain(data: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data });
  c.then = (resolve: (v: { data: unknown }) => void) => resolve({ data });
  return c;
}

// Fake admin client whose per-table data is scripted; records which tables were queried.
function fakeClient(rows: Record<string, unknown>, queried: string[]) {
  return {
    from(table: string) {
      queried.push(table);
      return chain(rows[table] ?? null);
    },
  };
}

const queried: string[] = [];
let ROWS: Record<string, unknown> = {};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeClient(ROWS, queried),
}));

import {
  isCompanyMonitorable,
  getMonitoredSession,
  listCompanySessions,
} from "../vendorMonitoring";

beforeEach(() => {
  queried.length = 0;
  ROWS = {};
});

describe("vendorMonitoring allowlist boundary", () => {
  it("isCompanyMonitorable is true only when a scope row exists", async () => {
    ROWS = { vendor_monitoring_scope: { company_id: "co1" } };
    expect(await isCompanyMonitorable("co1")).toBe(true);
    ROWS = { vendor_monitoring_scope: null };
    expect(await isCompanyMonitorable("coX")).toBe(false);
  });

  it("getMonitoredSession returns null AND never queries transcript segments when the company is OFF the allowlist", async () => {
    ROWS = {
      coaching_sessions: { id: "s1", company_id: "coX", agent_id: "rep1" },
      vendor_monitoring_scope: null, // coX not monitorable
    };
    const result = await getMonitoredSession("s1");
    expect(result).toBeNull();
    // The rail: the allowlist check gates BEFORE the transcript read.
    expect(queried).toContain("coaching_sessions");
    expect(queried).toContain("vendor_monitoring_scope");
    expect(queried).not.toContain("coaching_transcript_segments");
  });

  it("getMonitoredSession returns the session + segments when the company IS on the allowlist", async () => {
    ROWS = {
      coaching_sessions: { id: "s1", company_id: "co1", agent_id: "rep1" },
      vendor_monitoring_scope: { company_id: "co1" },
      coaching_transcript_segments: [{ speaker: "agent", text: "hi", seq: 0 }],
      profiles: [{ id: "rep1", full_name: "Rep One" }],
    };
    const result = await getMonitoredSession("s1");
    expect(result).not.toBeNull();
    expect(result?.company_id).toBe("co1");
    expect(result?.segments).toHaveLength(1);
    expect(queried).toContain("coaching_transcript_segments");
  });

  it("getMonitoredSession returns null for a missing session (no allowlist query needed)", async () => {
    ROWS = { coaching_sessions: null };
    expect(await getMonitoredSession("nope")).toBeNull();
  });

  it("listCompanySessions returns [] (and reads no sessions) when the company is OFF the allowlist", async () => {
    ROWS = { vendor_monitoring_scope: null };
    const result = await listCompanySessions("coX");
    expect(result).toEqual([]);
    expect(queried).not.toContain("coaching_sessions");
  });
});
