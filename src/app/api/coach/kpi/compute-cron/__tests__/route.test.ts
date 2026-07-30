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
});
