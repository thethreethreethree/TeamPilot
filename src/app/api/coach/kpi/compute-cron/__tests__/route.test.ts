import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/compute-cron — scheduled KPI snapshot persistence. Security boundary: it must run ONLY
 * for the scheduler. Locks: 503 when CRON_SECRET is unset (disabled, not open), and 401 on a wrong/missing
 * Bearer. constantTimeEqual is the REAL comparator. The admin client is mocked but never reached on the
 * auth-failure paths.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

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
});
