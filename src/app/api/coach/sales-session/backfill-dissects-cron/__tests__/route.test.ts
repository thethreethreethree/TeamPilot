import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * GET /api/coach/sales-session/backfill-dissects-cron — a public Vercel Cron endpoint. Previously untested.
 * Pins the CRON_SECRET auth gate: 503 when the secret is unset, and 401 on a wrong or absent Bearer — a
 * public URL that must NOT be triggerable by anyone (it runs an all-company backfill under the service role).
 * constantTimeEqual is the real primitive; the backfill is mocked so the gate is tested in isolation.
 */
vi.mock("@/lib/coach/v5/dissectBackfill", () => ({ runDissectBackfill: vi.fn(async () => ({ backfilled: 0 })) }));

import { GET } from "../route";

const req = (authHeader?: string) =>
  ({
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? (authHeader ?? null) : null) },
  }) as unknown as Parameters<typeof GET>[0];

const OLD = process.env.CRON_SECRET;
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
  vi.clearAllMocks();
});

describe("GET /api/coach/sales-session/backfill-dissects-cron — CRON_SECRET gate", () => {
  it("503 when CRON_SECRET is unset — the cron stays disabled until configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent Bearer token — not triggerable by anyone", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });

  it("200 on the correct Bearer token — the backfill runs", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
  });
});
