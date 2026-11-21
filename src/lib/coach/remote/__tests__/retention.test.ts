import { describe, it, expect } from "vitest";
import { DEFAULT_KEEP_PER_REP, keepFor, latestPerCompany, loadRetention, parseKeep } from "../retention";

describe("retention (0284, D14)", () => {
  it("the default is today's 20", () => {
    expect(DEFAULT_KEEP_PER_REP).toBe(20);
    expect(keepFor(new Map(), "co1")).toBe(20);
    expect(keepFor(new Map(), null)).toBe(20);
  });
  it("the latest row per company wins, in any order", () => {
    const m = latestPerCompany([
      { id: 5, company_id: "a", keep_last_per_rep: 50 },
      { id: 9, company_id: "a", keep_last_per_rep: 9 },
      { id: 7, company_id: "b", keep_last_per_rep: 70 },
      { id: 3, company_id: "a", keep_last_per_rep: 3 },
    ]);
    expect(keepFor(m, "a")).toBe(9);
    expect(keepFor(m, "b")).toBe(70);
    expect(keepFor(m, "c")).toBe(20);
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
});
