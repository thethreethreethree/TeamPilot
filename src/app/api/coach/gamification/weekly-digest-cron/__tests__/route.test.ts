import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * weekly-digest-cron — the CRON_SECRET gate + a happy path. The digest run is faked; this locks that the endpoint
 * is 503 without the secret, 401 with a wrong Bearer, and returns the run result (incl. emailConfigured) when armed.
 */
const run = vi.hoisted(() => vi.fn());
const runReps = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/gamification/weeklyDigest", () => ({ runWeeklyManagerDigest: run, runWeeklyRepDigest: runReps }));

import { GET } from "../route";

const req = (auth?: string) =>
  new Request("http://localhost/api/coach/gamification/weekly-digest-cron", {
    headers: auth ? { authorization: auth } : {},
  }) as never;

const OLD = process.env.CRON_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  run.mockResolvedValue({ companies: 1, managersEmailed: 2, skippedNoActivity: 0, skippedNoEmail: 0, sendFailures: 0, emailConfigured: true });
  runReps.mockResolvedValue({ repsEmailed: 5, skippedNoActivity: 0, skippedNoEmail: 0, sendFailures: 0, emailConfigured: true });
});
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
});

describe("GET weekly-digest-cron", () => {
  it("503 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer s3cret"))).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it("401 with a wrong Bearer", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("401 with no Authorization header", async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it("D10 (founder 2026-11-22): the managers' email no longer sends; the reps' own progress email still does", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(run).not.toHaveBeenCalled();
    expect(runReps).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, managers: { skipped: "D10: manager alerts are in-app only" }, reps: { repsEmailed: 5 } });
  });
});
