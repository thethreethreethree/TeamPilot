import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * GET /api/diagnosis/task-overrun-sweep-cron — a public Vercel Cron endpoint. Previously untested.
 * Pins the CRON_SECRET auth gate: 503 when the secret is unset (the cron is disabled until configured),
 * and 401 on a wrong or absent Bearer token — a public URL that must NOT be triggerable by anyone. A
 * regression that dropped the gate would expose the sweep to any caller with no test to catch it.
 * constantTimeEqual is the real primitive; the sweep is mocked so the gate is tested in isolation.
 */
vi.mock("@/lib/diagnosis/taskOverrunSweep", () => ({ sweepTaskOverruns: vi.fn(async () => ({ swept: 0 })) }));

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

describe("GET /api/diagnosis/task-overrun-sweep-cron — CRON_SECRET gate", () => {
  it("503 when CRON_SECRET is unset — the cron stays disabled until configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent Bearer token — not triggerable by anyone", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });

  it("200 on the correct Bearer token — the sweep runs", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
  });
});
