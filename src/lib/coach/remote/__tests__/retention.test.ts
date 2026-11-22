import { describe, it, expect } from "vitest";
import { DEFAULT_KEEP_PER_REP, DEFAULT_RETENTION_DAYS, latestPerCompany, loadRetention, outsideRetention, parseKeep, ruleFor } from "../retention";

describe("retention (0284, D14)", () => {
  it("the default is 90 days (D14 decided 2026-11-23); 20 is only where the 'last N' box starts", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(90);
    expect(DEFAULT_KEEP_PER_REP).toBe(20);
    expect(ruleFor(new Map(), "co1")).toEqual({ kind: "days", days: 90 });
    expect(ruleFor(new Map(), null)).toEqual({ kind: "days", days: 90 });
  });
  it("the latest row per company wins, in any order", () => {
    const m = latestPerCompany([
      { id: 5, company_id: "a", keep_last_per_rep: 50 },
      { id: 9, company_id: "a", keep_last_per_rep: 9 },
      { id: 7, company_id: "b", keep_last_per_rep: 70 },
      { id: 3, company_id: "a", keep_last_per_rep: 3 },
    ]);
    expect(ruleFor(m, "a")).toEqual({ kind: "count", keepPerRep: 9 });
    expect(ruleFor(m, "b")).toEqual({ kind: "count", keepPerRep: 70 });
    expect(ruleFor(m, "c")).toEqual({ kind: "days", days: 90 });
  });
  it("accepts whole numbers 1-1000 only", () => {
    for (const ok of [1, 20, 1000, "35"]) expect(parseKeep(ok)).not.toBeNull();
    for (const bad of [0, -1, 1001, 2.5, "", "ten", null, undefined, NaN]) expect(parseKeep(bad)).toBeNull();
  });
  // Review #5 (0296 round): only a missing TABLE falls back to 20. A missing column must stop the purge, or a company
  // that chose to keep more would lose audio to the default.
  const failing = (error: { code?: string; message: string }) =>
    ({ from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: null, error }) }) }) }) }) as never;
  it("a missing table → the D14 default applies (tableMissing)", async () => {
    for (const e of [
      { code: "PGRST205", message: "Could not find the table 'public.company_recording_settings' in the schema cache" },
      { message: 'relation "public.company_recording_settings" does not exist' },
    ]) {
      expect(await loadRetention(failing(e))).toMatchObject({ ok: true, tableMissing: true });
    }
  });
  it("a missing COLUMN, or any other failure, is an error — never the default", async () => {
    for (const e of [
      { code: "PGRST204", message: "Could not find the 'keep_last_per_rep' column of 'company_recording_settings' in the schema cache" },
      { code: "42703", message: "column company_recording_settings.keep_last_per_rep does not exist" },
      { message: "connection reset" },
    ]) {
      expect(await loadRetention(failing(e))).toMatchObject({ ok: false });
    }
  });

  describe("outsideRetention — the one decision the purge cron acts on", () => {
    const NOW = Date.parse("2026-11-23T12:00:00Z");
    const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
    const row = (id: string, company: string | null, agent: string | null, daysAgo: number) =>
      ({ id, company_id: company, agent_id: agent, created_at: ago(daysAgo) });

    it("default: older than 90 days goes, however few calls the rep has; anything newer stays, however many", () => {
      const rows = [
        ...Array.from({ length: 40 }, (_, i) => row(`new${i}`, "co1", "rep-1", i)), // 40 recent calls: all stay
        row("edge", "co1", "rep-2", 89.9),
        row("old", "co1", "rep-2", 90.1), // rep-2's only old call: goes even though rep-2 has 2 calls
      ];
      expect(outsideRetention(rows, new Map(), NOW).map((r) => r.id)).toEqual(["old"]);
    });

    it("a company's own 'last N' counts per rep, newest-first, and ignores age", () => {
      const settings = latestPerCompany([{ id: 1, company_id: "co2", keep_last_per_rep: 2 }]);
      const rows = [
        row("a1", "co2", "rep-a", 400), row("b1", "co2", "rep-b", 1), row("a2", "co2", "rep-a", 500),
        row("b2", "co2", "rep-b", 2), row("b3", "co2", "rep-b", 3), row("a3", "co2", "rep-a", 600),
      ];
      expect(outsideRetention(rows, settings, NOW).map((r) => r.id)).toEqual(["b3", "a3"]);
    });

    it("a latest row with NO count (0308, back to the standard) is the 90-day default again", () => {
      const settings = latestPerCompany([
        { id: 1, company_id: "co3", keep_last_per_rep: 1 },
        { id: 2, company_id: "co3", keep_last_per_rep: null },
      ]);
      expect(ruleFor(settings, "co3")).toEqual({ kind: "days", days: 90 });
      const rows = [row("x1", "co3", "r", 1), row("x2", "co3", "r", 2), row("x3", "co3", "r", 95)];
      expect(outsideRetention(rows, settings, NOW).map((r) => r.id)).toEqual(["x3"]);
    });

    it("two companies, two rules, in one pass", () => {
      const settings = latestPerCompany([{ id: 1, company_id: "counted", keep_last_per_rep: 1 }]);
      const rows = [row("c1", "counted", "r1", 1), row("c2", "counted", "r1", 2), row("d1", "dflt", "r2", 200), row("d2", "dflt", "r2", 3)];
      expect(outsideRetention(rows, settings, NOW).map((r) => r.id)).toEqual(["c2", "d1"]);
    });
  });
});
