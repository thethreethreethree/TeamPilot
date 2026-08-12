import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/compute-cron — scheduled KPI snapshot persistence. Security boundary: it must run ONLY
 * for the scheduler. Locks: 503 when CRON_SECRET is unset (disabled, not open), and 401 on a wrong/missing
 * Bearer. constantTimeEqual is the REAL comparator. The admin client is mocked but never reached on the
 * auth-failure paths.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const req = (authHeader: string | null) =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? authHeader : null) } }) as unknown as Parameters<typeof GET>[0];

const savedSecret = process.env.CRON_SECRET;
beforeEach(() => {
  delete process.env.CRON_SECRET;
});
afterEach(() => {
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
});

describe("GET /api/coach/kpi/compute-cron — auth", () => {
  it("503 (disabled) when CRON_SECRET is unset — never open by default", async () => {
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong Bearer token", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
  });

  it("401 on a missing Authorization header", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect((await GET(req(null))).status).toBe(401);
  });

  it("runs cleanly with no agents → computed:0 (no crash on empty data)", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => {
        const chain: Record<string, unknown> = {};
        chain.select = (c: unknown) => { chain._enum = typeof c === "string" && c.includes("company_id"); return chain; };
        chain.order = () => chain;
        chain.range = () => chain;
        chain.in = () => chain;
        chain.limit = () => chain;
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
        return chain;
      },
    });
    const res = await GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ computed: 0, snapshots: 0, scannedAgents: 0, bounded: false });
  });

  it("persists BOTH the live 'current' snapshot AND an immutable monthly ('YYYY-MM') one per metric", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const inserts: { metric: string; period: string }[] = [];
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = (c: unknown) => { chain._enum = typeof c === "string" && c.includes("company_id"); return chain; };
        chain.order = () => chain;
        chain.range = () => chain;
        chain.eq = () => chain;
        chain.in = () => chain;
        chain.delete = () => chain;
        chain.insert = (obj: { metric: string; period: string }) => {
          inserts.push({ metric: obj.metric, period: obj.period });
          return Promise.resolve({ error: null });
        };
        chain.then = (resolve: (v: unknown) => unknown) => {
          if (t === "coaching_sessions") {
            return resolve(
              chain._enum
                ? { data: [{ company_id: "co1", agent_id: "a1" }], error: null } // distinct-agents scan
                : {
                    // one agent's sessions (agent_id needed — the cron batches the read then groups by it)
                    data: [
                      {
                        id: "s1",
                        agent_id: "a1",
                        outcome: "sold",
                        deal_value: 100,
                        started_at: "2026-07-01T10:00:00.000Z",
                        ended_at: "2026-07-01T10:30:00.000Z",
                      },
                    ],
                    error: null,
                  }
            );
          }
          return resolve({ data: [], error: null }); // kpi_snapshot delete → no-op
        };
        return chain;
      },
    });

    const res = await GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    const periods = new Set(inserts.map((i) => i.period));
    // Exactly two distinct periods: the live 'current' and one month key.
    expect(periods.has("current")).toBe(true);
    const monthKeys = [...periods].filter((p) => /^\d{4}-\d{2}$/.test(p));
    expect(monthKeys).toHaveLength(1);
    // Every metric was written under BOTH periods (6 Layer-1/2 metrics × 2 periods = 12 inserts).
    expect(inserts).toHaveLength(12);
    const currentMetrics = inserts.filter((i) => i.period === "current").map((i) => i.metric).sort();
    const monthMetrics = inserts.filter((i) => i.period === monthKeys[0]).map((i) => i.metric).sort();
    expect(monthMetrics).toEqual(currentMetrics);
  });

  it("surfaces snapshot insert failures instead of silently dropping them (a dropped KPI must never be silent)", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = (c: unknown) => { chain._enum = typeof c === "string" && c.includes("company_id"); return chain; };
        chain.order = () => chain;
        chain.range = () => chain;
        chain.eq = () => chain;
        chain.in = () => chain;
        chain.delete = () => chain;
        // Every insert FAILS — the delete already ran, so this is the silent-drop scenario. Pre-fix the
        // failure was swallowed (no counter, no log); it must now be surfaced.
        chain.insert = () => Promise.resolve({ error: { message: "insert failed" } });
        chain.then = (resolve: (v: unknown) => unknown) => {
          if (t === "coaching_sessions") {
            return resolve(
              chain._enum
                ? { data: [{ company_id: "co1", agent_id: "a1" }], error: null }
                : {
                    data: [
                      {
                        id: "s1",
                        agent_id: "a1",
                        outcome: "sold",
                        deal_value: 100,
                        started_at: "2026-07-01T10:00:00.000Z",
                        ended_at: "2026-07-01T10:30:00.000Z",
                      },
                    ],
                    error: null,
                  }
            );
          }
          return resolve({ data: [], error: null });
        };
        return chain;
      },
    });

    const res = await GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { snapshots: number; snapshotErrors: number };
    // 6 Layer-1/2 metrics × 2 periods = 12 attempted inserts, all failing → 0 snapshots, 12 surfaced errors.
    expect(body.snapshots).toBe(0);
    expect(body.snapshotErrors).toBe(12);
    expect(errSpy).toHaveBeenCalled(); // the failure is logged, not swallowed
  });

  // DATA-AS-ASSET (§3.1) — the frozen-month guarantee lives on the DELETE side, and that is the real
  // history-destruction risk: the idempotent replace clears a snapshot before re-inserting it, so if the
  // clear ever widened to "all periods for this (agent, metric)" — e.g. dropping the .eq("period") filter in
  // a refactor — every FROZEN past-month row would be wiped, silently destroying the longitudinal trajectory
  // the whole KPI system exists to build. The insert-side test above can't catch that (it would still insert
  // only current + this month). So assert the DELETE is period-scoped and only ever targets {current, this
  // month} — never a past month. A regression that broadens the clear fails here.
  it("only ever DELETES the 'current' + current-month snapshots — never a frozen past month (Data-as-Asset)", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const deletes: { periodScoped: boolean; period: string | null }[] = [];
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: (t: string) => {
        const chain: Record<string, unknown> = {};
        let isDelete = false;
        let deletePeriod: string | null = null;
        let deleteHasPeriodFilter = false;
        chain.select = (c: unknown) => { chain._enum = typeof c === "string" && c.includes("company_id"); return chain; };
        chain.order = () => chain;
        chain.range = () => chain;
        chain.in = () => chain;
        chain.delete = () => {
          isDelete = true;
          return chain;
        };
        chain.eq = (col: string, val: unknown) => {
          if (isDelete && col === "period") {
            deleteHasPeriodFilter = true;
            deletePeriod = val as string;
          }
          return chain;
        };
        chain.insert = () => Promise.resolve({ error: null });
        chain.then = (resolve: (v: unknown) => unknown) => {
          if (t === "coaching_sessions") {
            return resolve(
              chain._enum
                ? { data: [{ company_id: "co1", agent_id: "a1" }], error: null }
                : {
                    data: [
                      {
                        id: "s1",
                        agent_id: "a1",
                        outcome: "sold",
                        deal_value: 100,
                        started_at: "2026-07-01T10:00:00.000Z",
                        ended_at: "2026-07-01T10:30:00.000Z",
                      },
                    ],
                    error: null,
                  }
            );
          }
          // kpi_snapshot delete resolves here — record its scope, then reset for the chain's next use.
          if (isDelete) {
            deletes.push({ periodScoped: deleteHasPeriodFilter, period: deletePeriod });
            isDelete = false;
            deleteHasPeriodFilter = false;
            deletePeriod = null;
          }
          return resolve({ data: [], error: null });
        };
        return chain;
      },
    });

    const res = await GET(req("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    // Every clear happened (6 metrics × 2 periods = 12) and EVERY one was scoped by an explicit period filter.
    expect(deletes).toHaveLength(12);
    expect(deletes.every((d) => d.periodScoped)).toBe(true);
    // The only periods ever cleared are 'current' and THIS UTC month — never a frozen past month.
    const now = new Date();
    const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const clearedPeriods = new Set(deletes.map((d) => d.period));
    expect([...clearedPeriods].sort()).toEqual(["current", thisMonth].sort());
  });
});
