import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

/** The nightly revenue cron: 503 until CRON_SECRET is set (said plainly), 401 on a wrong secret, 500 when a company was skipped. */
const st = vi.hoisted(() => ({ result: { companies: 1, snapshots: 2, failedCompanies: 0, fired: 0 } as Record<string, unknown> }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/coach/remote/revenue/daily", () => ({ runRevenueDaily: vi.fn(async () => st.result) }));
import { GET } from "../route";
const call = (auth?: string) => GET(new NextRequest("http://x/api", auth ? { headers: { authorization: auth } } : {}));
afterEach(() => vi.unstubAllEnvs());

describe("revenue-daily-cron", () => {
  it("503 while CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = await call("Bearer x");
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/CRON_SECRET/);
  });
  it("401 on a wrong secret; ok with the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call("Bearer nope")).status).toBe(401);
    const r = await call("Bearer s3cret");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, snapshots: 2 });
  });
  it("a skipped company is a 500 with the counts, never ok", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    st.result = { companies: 1, snapshots: 2, failedCompanies: 1, fired: 0 };
    const r = await call("Bearer s3cret");
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ ok: false, failedCompanies: 1 });
  });
});
