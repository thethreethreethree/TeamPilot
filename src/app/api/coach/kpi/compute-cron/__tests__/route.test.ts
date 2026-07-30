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
        chain.select = () => chain;
        chain.order = () => chain;
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
        let limited = false;
        chain.select = () => chain;
        chain.order = () => chain;
        chain.eq = () => chain;
        chain.delete = () => chain;
        chain.limit = () => {
          limited = true;
          return chain;
        };
        chain.insert = (obj: { metric: string; period: string }) => {
          inserts.push({ metric: obj.metric, period: obj.period });
          return Promise.resolve({ error: null });
        };
        chain.then = (resolve: (v: unknown) => unknown) => {
          if (t === "coaching_sessions") {
            return resolve(
              limited
                ? { data: [{ company_id: "co1", agent_id: "a1" }], error: null } // distinct-agents scan
                : {
                    // one agent's sessions
                    data: [
                      {
                        id: "s1",
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
});
