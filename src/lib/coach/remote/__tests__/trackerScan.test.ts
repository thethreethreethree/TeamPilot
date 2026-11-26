import { describe, it, expect, vi } from "vitest";
import { scanSessionTrackers } from "../trackerScan";

/**
 * scanSessionTrackers (RSS Phase 3, migration 0276). Pins: door sessions and meetings are skipped; hits carry the
 * segment's time from the session start (null when there is no wall clock), the agent mapped to 'rep', the
 * transcript version; writes are idempotent by inserting only hits not already stored (never ON CONFLICT, which
 * Postgres refuses on a table with an UPDATE rule); nothing throws.
 */
function fake(session: Record<string, unknown> | null, segs: Array<Record<string, unknown>>, trackers: unknown[], stored: unknown[] = []) {
  const inserts: Array<{ rows: unknown }> = [];
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    if (table === "tracker_hits") b.upsert = () => { throw new Error("ON CONFLICT is refused on a rule table"); };
    b.maybeSingle = async () => ({ data: session, error: null });
    b.then = (res: (v: unknown) => unknown) =>
      res({ data: table === "keyword_trackers_live" ? trackers : table === "tracker_hits" ? stored : segs, error: null });
    b.insert = async (rows: unknown) => (inserts.push({ rows }), { error: null });
    return b;
  };
  return { db: { from } as never, inserts };
}
const S = { id: "s1", company_id: "co1", agent_id: "rep1", context: "phone", session_kind: "sales", started_at: "2026-11-15T10:00:00.000Z" };
const T = [{ id: "t1", name: "Competitors", phrases: ["spectrum"], side: "any" }];

describe("scanSessionTrackers", () => {
  it("stores each hit with its offset, speaker and transcript version, idempotently", async () => {
    const { db, inserts } = fake(S, [
      { speaker: "customer", text: "We have Spectrum", seq: 3, spoken_at: "2026-11-15T10:03:12.000Z", version: 2 },
      { speaker: "agent", text: "Spectrum is fine", seq: 4, spoken_at: null, version: 2 },
    ], T);
    expect(await scanSessionTrackers("s1", db)).toBe(2);
    expect(inserts[0]!.rows).toEqual([
      { tracker_id: "t1", session_id: "s1", company_id: "co1", rep_id: "rep1", seq: 3, at_ms: 192000, speaker: "customer", matched: "spectrum", transcript_version: 2 },
      { tracker_id: "t1", session_id: "s1", company_id: "co1", rep_id: "rep1", seq: 4, at_ms: null, speaker: "rep", matched: "spectrum", transcript_version: 2 },
    ]);
  });

  it("a re-scan inserts only the hits not already stored for this version", async () => {
    const segs = [
      { speaker: "customer", text: "We have Spectrum", seq: 3, spoken_at: null, version: 2 },
      { speaker: "agent", text: "Spectrum is fine", seq: 4, spoken_at: null, version: 2 },
    ];
    const { db, inserts } = fake(S, segs, T, [{ tracker_id: "t1", seq: 3, matched: "spectrum" }]);
    expect(await scanSessionTrackers("s1", db)).toBe(2);
    expect((inserts[0]!.rows as Array<{ seq: number }>).map((r) => r.seq)).toEqual([4]);

    const all = fake(S, segs, T, [{ tracker_id: "t1", seq: 3, matched: "spectrum" }, { tracker_id: "t1", seq: 4, matched: "spectrum" }]);
    expect(await scanSessionTrackers("s1", all.db)).toBe(2);
    expect(all.inserts).toHaveLength(0);
  });

  it("a door session or a meeting is not scanned", async () => {
    expect(await scanSessionTrackers("s1", fake({ ...S, context: "in_person" }, [], T).db)).toBe(0);
    expect(await scanSessionTrackers("s1", fake({ ...S, session_kind: "meeting" }, [], T).db)).toBe(0);
  });

  it("never throws", async () => {
    const broken = { from: () => { throw new Error("boom"); } } as never;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await scanSessionTrackers("s1", broken)).toBeNull();
  });
});

describe("scanSessionTrackers — tracker dates (0344, F11.5)", () => {
  it("a tracker dated outside the call's start isn't matched; one inside is", async () => {
    const segs = [{ speaker: "customer", text: "We have Spectrum", seq: 3, spoken_at: null, version: 2 }];
    const later = fake(S, segs, [{ ...T[0], starts_on: "2026-12-01" }]); // the call is 15 Nov
    expect(await scanSessionTrackers("s1", later.db)).toBe(0);
    expect(later.inserts).toEqual([]);
    const ended = fake(S, segs, [{ ...T[0], ends_on: "2026-11-14" }]);
    expect(await scanSessionTrackers("s1", ended.db)).toBe(0);
    const inside = fake(S, segs, [{ ...T[0], starts_on: "2026-11-01", ends_on: "2026-11-15" }]);
    expect(await scanSessionTrackers("s1", inside.db)).toBe(1);
  });
});
