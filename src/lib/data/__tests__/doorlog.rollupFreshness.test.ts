import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A REFRESHED SUMMARY MUST LOOK FRESH (2026-10-01, from production).
 *
 * rollupDueReps refreshes a rep's summaries when the newest summary is older than their latest completed
 * pitch. The write is an upsert on (rep_id, period, period_start), and generated_at only had `default now()`,
 * which applies on INSERT. So after the first summary of a period, every refresh kept the old time, the gate
 * never closed, and the cron re-ran four AI calls for that rep every minute: 80 rows, 14,142 updates.
 */
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ upsert }) }),
}));

import { upsertRepPatternSummary } from "../doorlog";
import { isRepDueForRollup } from "@/lib/coach/doorlog/rollupWorker";

const args = {
  companyId: "co1",
  repId: "rep1",
  period: "week" as const,
  periodStart: "2026-09-28",
  rollup: { headline: "h", patterns_good: [], patterns_bad: [], trend: null },
  pitchCount: 3,
  model: "brain",
  promptVersion: "v1",
};

beforeEach(() => upsert.mockClear());

describe("a refreshed summary is stamped with the time it was written", () => {
  it("sends generated_at on every write, not only on the first insert", async () => {
    const before = Date.now();
    await upsertRepPatternSummary(args as never);
    const row = (upsert.mock.calls[0] as unknown[])[0] as { generated_at?: string };
    expect(row.generated_at).toBeTruthy();
    expect(Date.parse(row.generated_at!)).toBeGreaterThanOrEqual(before);
  });

  it("so the cron's gate closes: a rep is not due again right after a refresh", async () => {
    const latestPitch = new Date(Date.now() - 60_000).toISOString(); // a pitch a minute ago
    await upsertRepPatternSummary(args as never);
    const row = (upsert.mock.calls[0] as unknown[])[0] as { generated_at: string };
    expect(isRepDueForRollup(latestPitch, row.generated_at)).toBe(false);
  });
});
