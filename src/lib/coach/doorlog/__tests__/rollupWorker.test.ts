import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Rollup windowing — the GATE for F5 (audit 2026-08-18): the period window must key on the knock's device-tz
 * `local_date` (the SAME field the KPI strip counts), NOT the pitch's UTC `recorded_at`. Windowing on
 * recorded_at put an evening pitch in a behind-UTC tz into a different day/week than the KPI showed. And the
 * per-rep "today" anchors to the rep's MAX(local_date) (device-captured), not the cron's UTC today, so no
 * per-rep timezone needs storing. This test locks both against a regression back to the UTC bug.
 */

const gteCalls: { table: string; col: string; val: string }[] = [];
let maxLocalDate: string | null = "2026-08-18";
const pitchRow = {
  id: "p1",
  recorded_at: "2026-08-19T05:00:00Z", // UTC rolled to the NEXT day — the exact case recorded_at got wrong
  door_knocks: { outcome: "sold", local_date: "2026-08-18" },
  pitch_analyses: { summary: "s", strengths: [], improvements: [], scores: {} },
};

function chainFor(table: string) {
  const chain: Record<string, unknown> = { __table: table, __isCount: false };
  chain.select = (_cols: string, opts?: { head?: boolean }) => {
    (chain as { __isCount: boolean }).__isCount = Boolean(opts?.head);
    return chain;
  };
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.gte = (col: string, val: string) => {
    gteCalls.push({ table, col, val });
    return chain;
  };
  chain.maybeSingle = async () => {
    if (table === "door_knocks") return { data: maxLocalDate ? { local_date: maxLocalDate } : null };
    return { data: null }; // rep_pattern_summaries: no previous summary
  };
  // Awaiting the chain resolves the pitch list or the head:true count.
  chain.then = (resolve: (v: unknown) => void) =>
    resolve((chain as { __isCount: boolean }).__isCount ? { count: 1 } : { data: table === "pitches" ? [pitchRow] : [] });
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => chainFor(t) }) }));
vi.mock("@/lib/coach/doorlog/rollup", () => ({
  ROLLUP_PROMPT_VERSION: "v1",
  generateRepPatternRollup: vi.fn(async () => ({ headline: "h", patternsGood: [], patternsBad: [], trend: null })),
}));
vi.mock("@/lib/data/doorlog", () => ({ upsertRepPatternSummary: vi.fn(async () => {}) }));

import { rollupRep, isRepDueForRollup } from "../rollupWorker";

beforeEach(() => {
  gteCalls.length = 0;
  maxLocalDate = "2026-08-18";
});

describe("rollupRep — F5 local_date windowing", () => {
  it("windows on door_knocks.local_date, NEVER on recorded_at", async () => {
    await rollupRep({ companyId: "co1", repId: "rep1", todayIso: "2026-08-19" });
    // Every date window filter is on the embedded local_date...
    expect(gteCalls.some((c) => c.col === "door_knocks.local_date")).toBe(true);
    // ...and NONE is on recorded_at (the UTC-drift bug).
    expect(gteCalls.some((c) => c.col === "recorded_at")).toBe(false);
  });

  it("anchors 'today' to the rep's MAX(local_date), not the cron's UTC today", async () => {
    // maxLocalDate = 2026-08-18 while the cron passes UTC today = 2026-08-19. The 'day' window must start at
    // the rep's local day (08-18), not the UTC day (08-19) — else an evening pitch drops out of the day rollup.
    await rollupRep({ companyId: "co1", repId: "rep1", todayIso: "2026-08-19" });
    const dayStarts = gteCalls.filter((c) => c.col === "door_knocks.local_date").map((c) => c.val);
    expect(dayStarts).toContain("2026-08-18"); // day window = rep's local today
    expect(dayStarts).toContain("2026-08-12"); // week = local today − 6
    expect(dayStarts).not.toContain("2026-08-19"); // never the cron's UTC today
  });

  it("falls back to the cron's UTC today only when the rep has no knocks yet", async () => {
    maxLocalDate = null; // rep has never knocked
    await rollupRep({ companyId: "co1", repId: "rep1", todayIso: "2026-08-19" });
    const starts = gteCalls.filter((c) => c.col === "door_knocks.local_date").map((c) => c.val);
    expect(starts).toContain("2026-08-19"); // day window uses the fallback
  });
});

describe("isRepDueForRollup — cost gate (no every-minute LLM re-run)", () => {
  it("is due when the latest completed pitch is NEWER than the newest summary", () => {
    expect(isRepDueForRollup("2026-08-18T10:00:00Z", "2026-08-18T09:00:00Z")).toBe(true);
  });
  it("is NOT due when the summary is already at/after the latest pitch (skip the redundant re-run)", () => {
    expect(isRepDueForRollup("2026-08-18T09:00:00Z", "2026-08-18T09:00:00Z")).toBe(false); // equal → current
    expect(isRepDueForRollup("2026-08-18T09:00:00Z", "2026-08-18T10:00:00Z")).toBe(false); // summary newer
  });
  it("is always due when the rep has no summary yet (first rollup)", () => {
    expect(isRepDueForRollup("2026-08-18T09:00:00Z", undefined)).toBe(true);
  });
});
