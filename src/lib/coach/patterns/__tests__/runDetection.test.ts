import { describe, it, expect, vi } from "vitest";
import { runDetection } from "../runDetection";
import { missedOrPartial, type GradedPitch } from "../detect";
import type { Grade } from "../../pitchScore/rubric";

/**
 * The writer.
 *
 * Detection is a SIDE EFFECT of scoring a pitch, which sets what matters here. The score is
 * already saved when this runs, so the failure mode that costs something is not "detection broke"
 * — it is detection breaking loudly enough to tell a rep their pitch could not be scored, or
 * quietly enough that a duplicate pattern is written on every pitch for the rest of the month.
 */

const p = (day: number, grade: Grade): GradedPitch => ({
  pitchId: `p${day}`,
  recordedAt: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
  grade,
  points: grade === "hit" ? 3 : grade === "partial" ? 1.5 : 0,
});
const run = (grades: Grade[]) => grades.map((g, i) => p(i + 1, g));
const M: Grade = "missed";
const H: Grade = "hit";

/** A Supabase double that records what it was asked to write. */
function db(opts: { upsertError?: string; returned?: Array<{ id: string }> } = {}) {
  const calls: Array<{ table: string; rows: unknown; onConflict?: string; ignoreDuplicates?: boolean }> = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: unknown, o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
          calls.push({ table, rows, ...o });
          return {
            select: async () =>
              opts.upsertError
                ? { data: null, error: { message: opts.upsertError } }
                : { data: opts.returned ?? (rows as unknown[]).map((_, i) => ({ id: `new-${i}` })), error: null },
          };
        },
        insert(rows: unknown) {
          calls.push({ table, rows });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client: client as never, calls };
}

const grades = (m: Record<string, Grade[]>) =>
  new Map(Object.entries(m).map(([k, v]) => [k, run(v)]));

describe("what it writes", () => {
  it("opens a pattern for an element missed 3 of the last 10 applicable pitches", async () => {
    const { client, calls } = db();
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M, H, H] }) },
      client
    );
    expect(r).toMatchObject({ detected: 1, opened: 1 });
    const rows = calls[0]!.rows as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      company_id: "co",
      rep_id: "rep",
      item_kind: "element",
      item_id: "intro.trucks",
      misses_at_detection: 3,
      applicable_at_detection: 5,
    });
  });

  it("freezes the strip and the cost at detection", async () => {
    const { client, calls } = db();
    await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M, H] }) },
      client
    );
    const row = (calls[0]!.rows as Array<Record<string, unknown>>)[0]!;
    // Newest-first: the hit is day 4.
    expect(row.strip_at_detection).toEqual(["hit", "missed", "missed", "missed"]);
    // 3 points lost x3, 0 for the hit, over 4 pitches.
    expect(row.cost_per_pitch).toBe(2.3);
    expect(row.rubric_version).toBe("attfiber-v1");
  });

  it("writes nothing when nothing meets the threshold", async () => {
    const { client, calls } = db();
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, H, H] }) },
      client
    );
    expect(r).toMatchObject({ detected: 0, opened: 0, examined: 1 });
    expect(calls).toHaveLength(0);
  });

  it("skips items that are not rubric elements rather than guessing at them", async () => {
    // Bonuses and violations live in a table with no grade column, so applicable-is-row-presence
    // does not hold for them. A silent skip and a considered one look identical in the data;
    // this pins the considered one.
    const { client } = db();
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "bonus.directv": [M, M, M], "nope.invented": [M, M, M] }) },
      client
    );
    expect(r).toMatchObject({ examined: 2, detected: 0, opened: 0 });
  });

  it("carries the miss predicate through, so B4 is one argument here too", async () => {
    const g = grades({ "intro.trucks": ["partial", "partial", "partial", H] });
    const { client } = db();
    expect((await runDetection({ companyId: "co", repId: "rep", gradesByItem: g }, client)).detected).toBe(0);
    const second = db();
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: g, isMiss: missedOrPartial },
      second.client
    );
    expect(r.detected).toBe(1);
  });
});

describe("running on every pitch must not accumulate duplicates", () => {
  it("upserts on the open-pattern key and ignores conflicts", async () => {
    const { client, calls } = db();
    await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M] }) },
      client
    );
    // Without both of these, a rep with a standing pattern gains one duplicate row per pitch —
    // their chip count climbs on its own and a manager coaches the same thing five times.
    expect(calls[0]).toMatchObject({ onConflict: "company_id,rep_id,item_id", ignoreDuplicates: true });
  });

  it("reports `opened` from what the database accepted, not from what it was offered", async () => {
    // The second run for the same miss: two rows offered, none accepted. `detected` and `opened`
    // are different numbers and conflating them would report a new pattern on every pitch.
    const { client } = db({ returned: [] });
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M], "disc.currentBill": [M, M, M] }) },
      client
    );
    expect(r.detected).toBe(2);
    expect(r.opened).toBe(0);
  });
});

describe("a write failure degrades, it does not propagate", () => {
  it("returns a result instead of throwing when the upsert fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = db({ upsertError: "permission denied for table patterns" });
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M] }) },
      client
    );
    // The rep's score is already saved by the time this runs. Throwing here would tell them the
    // pitch could not be scored, which is false.
    expect(r).toMatchObject({ detected: 1, opened: 0 });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("keeps the failure server-side — the message never becomes a return value", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = db({ upsertError: 'duplicate key value violates unique constraint "patterns_open_unique"' });
    const r = await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M] }) },
      client
    );
    expect(JSON.stringify(r)).not.toMatch(/constraint|duplicate key/);
    err.mockRestore();
  });

  it("logs WHO it failed for, because this runs after a 200 and the log is the only trace", async () => {
    // Found by mutation: collapsing the log to `error.message` alone changed no test. It is not a
    // leak — nothing reaches the client either way — but it is the difference between a line that
    // can be acted on and one that cannot. This path returns success to the caller, so a log
    // without a rep id is the whole record of a failure nobody will ever connect to a person.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = db({ upsertError: "permission denied for table patterns" });
    await runDetection(
      { companyId: "co-42", repId: "rep-7", gradesByItem: grades({ "intro.trucks": [M, M, M] }) },
      client
    );
    const logged = String(err.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("rep-7");
    expect(logged).toContain("co-42");
    expect(logged).toContain("permission denied");
    err.mockRestore();
  });
});

describe("no pattern_events row is written", () => {
  it("writes only to `patterns`, because 'detected' is not one of the six kinds", async () => {
    // 0258's CHECK allows coached, drill_assigned, note, rep_reviewed, clip_disputed, fixed —
    // all six are things a HUMAN did. An insert of 'detected' would be rejected at runtime, on a
    // path that already returned 200, so the failure would be a log line nobody reads.
    const { client, calls } = db();
    await runDetection(
      { companyId: "co", repId: "rep", gradesByItem: grades({ "intro.trucks": [M, M, M] }) },
      client
    );
    expect(calls.map((c) => c.table)).toEqual(["patterns"]);
  });
});
