import { describe, it, expect, vi, beforeEach } from "vitest";
import { archivePitchScore, recordProvenance } from "../scoreHistory";

/**
 * The re-score archive and score provenance (RSS Phase 0 step 5, migration 0272).
 *
 * The fake applies `.eq` filters, so a read that drops its company filter returns another tenant's rows
 * and these tests fail (the INVARIANT 29 note about builders that ignore `.eq`).
 */
type Row = Record<string, unknown>;

function fakeDb(seed: Record<string, Row[]>, opts: { missing?: string[]; failRead?: string } = {}) {
  const inserts: Array<{ table: string; row: Row }> = [];
  const upserts: Array<{ table: string; row: Row; onConflict: string }> = [];
  const MISSING = { code: "PGRST205", message: "relation does not exist" };
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let head = false;
    const run = () => {
      if (opts.missing?.includes(table)) return { data: null, error: MISSING, count: null };
      if (opts.failRead === table) return { data: null, error: { code: "XX000", message: "boom" }, count: null };
      const rows = (seed[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      return { data: head ? null : rows, error: null, count: rows.length };
    };
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), b),
      eq: (k: string, v: unknown) => (filters.push([k, v]), b),
      maybeSingle: async () => {
        const r = run();
        return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error };
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
      insert: async (row: Row) => {
        if (opts.missing?.includes(table)) return { error: MISSING };
        inserts.push({ table, row });
        return { error: null };
      },
      upsert: async (row: Row, o: { onConflict: string }) => {
        if (opts.missing?.includes(table)) return { error: MISSING };
        upserts.push({ table, row, onConflict: o.onConflict });
        return { error: null };
      },
    };
    return b;
  };
  return { db: { from } as never, inserts, upserts };
}

const PITCH = { id: "p1", company_id: "co1", rep_id: "rep1", total: 70 };
const seed = () => ({
  pitch_scores: [PITCH, { id: "p1", company_id: "co2", rep_id: "intruder", total: 1 }],
  pitch_score_elements: [{ pitch_id: "p1", company_id: "co1", element_id: "e1", grade: "hit" }],
  pitch_score_events: [{ pitch_id: "p1", company_id: "co1", item_id: "b1", type: "bonus" }],
  pitch_score_overrides: [
    { id: "o1", pitch_id: "p1", company_id: "co1" },
    { id: "o2", pitch_id: "p1", company_id: "co1" },
    { id: "ox", pitch_id: "p1", company_id: "co2" },
  ],
  pitch_score_provenance: [{ pitch_score_id: "p1", company_id: "co1", model: "m-old", prompt_version: "tpl-old" }],
});
const ARGS = { pitchId: "p1", companyId: "co1", archivedBy: "mgr1", reason: "  audio fixed  " };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("archivePitchScore", () => {
  it("copies the score, its evidence and its provenance, company-scoped, and counts earlier overrides", async () => {
    const { db, inserts } = fakeDb(seed());
    expect(await archivePitchScore(db, ARGS)).toEqual({ ok: true, earlierOverrides: 2 });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("pitch_score_archive");
    expect(inserts[0]!.row).toEqual({
      pitch_score_id: "p1",
      company_id: "co1",
      rep_id: "rep1",
      archived_payload: {
        pitch: PITCH,
        elements: seed().pitch_score_elements,
        events: seed().pitch_score_events,
        provenance: seed().pitch_score_provenance[0],
      },
      archived_by: "mgr1",
      reason: "audio fixed",
    });
  });

  it("a pitch outside the caller's company is not_found, and nothing is archived", async () => {
    const { db, inserts } = fakeDb(seed());
    expect(await archivePitchScore(db, { ...ARGS, companyId: "co3" })).toEqual({ ok: false, cause: "not_found" });
    expect(inserts).toEqual([]);
  });

  it("before 0272 (no archive table) it says not_applied, so the route can refuse the re-score", async () => {
    const { db } = fakeDb(seed(), { missing: ["pitch_score_archive", "pitch_score_provenance"] });
    expect(await archivePitchScore(db, ARGS)).toEqual({ ok: false, cause: "not_applied" });
  });

  it("a failed evidence read is a database failure, never an archive with missing evidence", async () => {
    const { db, inserts } = fakeDb(seed(), { failRead: "pitch_score_elements" });
    expect(await archivePitchScore(db, ARGS)).toEqual({ ok: false, cause: "database" });
    expect(inserts).toEqual([]);
  });

  it("a throwing client is a verdict, not an exception", async () => {
    const broken = { from: () => { throw new Error("boom"); } } as never;
    expect(await archivePitchScore(broken, ARGS)).toEqual({ ok: false, cause: "database" });
  });
});

describe("recordProvenance", () => {
  const P = { pitchId: "p1", companyId: "co1", repId: "rep1", model: "m1", promptVersion: "tpl-abc", rubricVersion: "attfiber-v1" };

  it("an automatic score is 'auto' with no scorer named", async () => {
    const { db, upserts } = fakeDb({});
    expect(await recordProvenance(db, P)).toBe(true);
    expect(upserts[0]!.row).toMatchObject({ scored_by_kind: "auto", scored_by: null, model: "m1", prompt_version: "tpl-abc" });
    expect(upserts[0]!.onConflict).toBe("pitch_score_id");
  });

  it("a manager re-score names the manager", async () => {
    const { db, upserts } = fakeDb({});
    await recordProvenance(db, { ...P, rescoredBy: "mgr1" });
    expect(upserts[0]!.row).toMatchObject({ scored_by_kind: "manager_rescore", scored_by: "mgr1" });
  });

  it("never throws into the scorer: a missing table or a throwing client is false", async () => {
    expect(await recordProvenance(fakeDb({}, { missing: ["pitch_score_provenance"] }).db, P)).toBe(false);
    expect(await recordProvenance({ from: () => { throw new Error("x"); } } as never, P)).toBe(false);
  });
});
