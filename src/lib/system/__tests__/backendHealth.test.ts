import { describe, it, expect, vi } from "vitest";
import {
  CRITICAL_AT,
  FREE_PLAN_STORAGE_BYTES,
  WARN_AT,
  overallStatus,
  probeSupabase,
  quotaFromEnv,
  storageLevel,
  type ProbeResult,
} from "../backendHealth";

/**
 * The 2026-11-11 outage: Supabase answered every request with 402 (exceed_storage_size_quota) while /api/health
 * said "ok". These lock the two halves that would have caught it — the probe reads a refusal as DOWN, and the
 * quota level warns before the hard stop — with both sides of every term exercised (CLAUDE.md §2.2).
 */

const RESTRICTED =
  "Service for this project is restricted due to the following violations: exceed_storage_size_quota. The project owner must upgrade their plan or remove spend caps to restore service.";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("probeSupabase", () => {
  it("a 200 from the gateway is reachable", async () => {
    const f = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { external: {} }));
    expect(await probeSupabase("https://x.supabase.co/", "anon", f)).toEqual({ reachable: true, httpStatus: 200, reason: null });
    // Hits the gateway sign-in uses, with the anon key, and strips the trailing slash.
    expect(f).toHaveBeenCalledWith("https://x.supabase.co/auth/v1/settings", expect.objectContaining({
      headers: { apikey: "anon", Authorization: "Bearer anon" },
    }));
  });

  it("the real 402 quota suspension is DOWN, carrying Supabase's message (the outage that read as 'ok')", async () => {
    const r = await probeSupabase("https://x.supabase.co", "anon", async () => jsonResponse(402, { message: RESTRICTED }));
    expect(r.reachable).toBe(false);
    expect(r.httpStatus).toBe(402);
    expect(r.reason).toContain("exceed_storage_size_quota");
  });

  it("a non-JSON error body is still DOWN, with a null reason", async () => {
    const r = await probeSupabase("https://x.supabase.co", "anon", async () => new Response("<html>bad gateway</html>", { status: 502 }));
    expect(r).toEqual({ reachable: false, httpStatus: 502, reason: null });
  });

  it("a network failure / timeout is DOWN with no status, and never throws", async () => {
    const r = await probeSupabase("https://x.supabase.co", "anon", async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    expect(r).toEqual({ reachable: false, httpStatus: null, reason: "The operation was aborted due to timeout" });
  });
});

describe("storageLevel", () => {
  const q = 1000;
  it.each([
    [0, "ok", 0],
    [q * WARN_AT - 1, "ok", 69.9],
    [q * WARN_AT, "warn", 70],
    [q * CRITICAL_AT - 1, "warn", 89.9],
    [q * CRITICAL_AT, "critical", 90],
    [q * 1.5, "critical", 150], // already over — still critical, not wrapped or capped
  ])("%d of %d bytes → %s", (used, level, pct) => {
    expect(storageLevel(used, q)).toEqual({ level, pct });
  });

  it.each([
    [null, q],
    [Number.NaN, q],
    [-1, q],
    [10, 0],
    [10, Number.NaN],
  ])("unmeasurable input (%s used, %s quota) is unknown, never a false ok", (used, quota) => {
    expect(storageLevel(used as number | null, quota)).toEqual({ level: "unknown", pct: null });
  });
});

describe("quotaFromEnv", () => {
  it("a positive number from env wins, and says so", () => {
    expect(quotaFromEnv("107374182400", FREE_PLAN_STORAGE_BYTES)).toEqual({ bytes: 107374182400, source: "env" });
  });
  it.each([undefined, "", "  ", "abc", "0", "-5"])("unset or invalid (%s) falls back to the free plan, and says so", (raw) => {
    expect(quotaFromEnv(raw, FREE_PLAN_STORAGE_BYTES)).toEqual({ bytes: FREE_PLAN_STORAGE_BYTES, source: "default-free-plan" });
  });
});

describe("overallStatus — the one verdict the route consumes", () => {
  const up: ProbeResult = { reachable: true, httpStatus: 200, reason: null };
  const down: ProbeResult = { reachable: false, httpStatus: 402, reason: RESTRICTED };

  it("demo mode (Supabase not configured) is ok — a legitimate state, as before", () => {
    expect(overallStatus({ supabaseEnabled: false, probe: null, levels: [] })).toBe("ok");
  });
  it("configured but refusing → down", () => {
    expect(overallStatus({ supabaseEnabled: true, probe: down, levels: ["ok", "ok"] })).toBe("down");
  });
  it("configured with no probe result → down (never assume up)", () => {
    expect(overallStatus({ supabaseEnabled: true, probe: null, levels: [] })).toBe("down");
  });
  it("reachable and both quotas ok → ok", () => {
    expect(overallStatus({ supabaseEnabled: true, probe: up, levels: ["ok", "ok"] })).toBe("ok");
  });
  it.each(["warn", "critical", "unknown"] as const)("reachable but one quota %s → degraded", (l) => {
    expect(overallStatus({ supabaseEnabled: true, probe: up, levels: ["ok", l] })).toBe("degraded");
  });
});
