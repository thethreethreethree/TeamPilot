import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * scanSmartTrackers / carrySmartHits (0329; founder picker "One AI read per call"). Pins: no smart tracker → no AI
 * call; meetings and door calls are skipped; ONE AI read covers every smart tracker; a hit stores the EXAMPLE (never
 * the customer's words), the line's time like a keyword hit, the transcript version; a backfill names one tracker;
 * an unreadable answer writes nothing and says so (null); a correction carries the untouched lines' hits forward
 * with no AI call.
 */
const ai = vi.hoisted(() => ({ text: "", suppressed: false, calls: [] as Array<{ userMessage: string }> }));
vi.mock("@/lib/claude", () => ({
  smartTrackerCoach: vi.fn(async (a: { userMessage: string }) => (ai.calls.push(a), { text: ai.text, suppressed: ai.suppressed })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("tests pass a client"); } }));

import { scanSmartTrackers, carrySmartHits } from "../smartTrackerScan";

function fake(opts: { session?: Record<string, unknown> | null; trackers?: unknown[]; segs?: unknown[]; stored?: unknown[] }) {
  const inserts: unknown[] = [];
  const filters: Array<[string, string, unknown]> = [];
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit"]) b[m] = () => b;
    b.eq = (k: string, v: unknown) => (filters.push([table, k, v]), b);
    b.maybeSingle = async () => ({ data: opts.session ?? null, error: null });
    b.then = (res: (v: unknown) => unknown) =>
      res({ data: table === "keyword_trackers" ? opts.trackers ?? [] : table === "tracker_hits" ? opts.stored ?? [] : opts.segs ?? [], error: null });
    b.insert = async (rows: unknown) => (inserts.push(rows), { error: null });
    return b;
  };
  return { db: { from } as never, inserts, filters };
}
const S = { id: "s1", company_id: "co1", agent_id: "rep1", context: "phone", session_kind: "sales", started_at: "2026-11-15T10:00:00.000Z", audio_started_at: null };
const T = [
  { id: "t1", name: "Locked in", phrases: ["We're locked into a contract"], side: "customer", kind: "smart" },
  { id: "t2", name: "Asks for the sale", phrases: ["Can we get you started today"], side: "rep", kind: "smart" },
];
const SEGS = [
  { speaker: "customer", text: "Honestly our Comcast deal doesn't end till June", seq: 3, spoken_at: "2026-11-15T10:01:05.000Z", version: 2 },
  { speaker: "agent", text: "Shall I set it up for you now?", seq: 4, spoken_at: null, version: 2 },
];

beforeEach(() => {
  ai.text = "";
  ai.suppressed = false;
  ai.calls = [];
});

describe("scanSmartTrackers", () => {
  it("no smart tracker: no AI call", async () => {
    const { db } = fake({ session: S, trackers: [], segs: SEGS });
    expect(await scanSmartTrackers("s1", db)).toBe(0);
    expect(ai.calls).toEqual([]);
  });

  it("a meeting is never read", async () => {
    const { db } = fake({ session: { ...S, session_kind: "meeting" }, trackers: T, segs: SEGS });
    expect(await scanSmartTrackers("s1", db)).toBe(0);
    expect(ai.calls).toEqual([]);
  });

  it("one AI read for all trackers; hits store the example, the line's time and the version — and a wrong-side hit is dropped", async () => {
    ai.text = JSON.stringify({ hits: [{ tracker: 1, line: 3, example: 1 }, { tracker: 2, line: 4, example: 1 }, { tracker: 1, line: 4, example: 1 }, { tracker: 9, line: 3 }] });
    const { db, inserts } = fake({ session: S, trackers: T, segs: SEGS });
    expect(await scanSmartTrackers("s1", db)).toBe(2);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]!.userMessage).toContain("Locked in");
    expect(ai.calls[0]!.userMessage).toContain("Asks for the sale");
    expect(inserts[0]).toEqual([
      { tracker_id: "t1", session_id: "s1", company_id: "co1", rep_id: "rep1", seq: 3, at_ms: 65000, speaker: "customer", matched: "We're locked into a contract", transcript_version: 2 },
      { tracker_id: "t2", session_id: "s1", company_id: "co1", rep_id: "rep1", seq: 4, at_ms: null, speaker: "rep", matched: "Can we get you started today", transcript_version: 2 },
    ]);
    const stored = JSON.stringify(inserts);
    expect(stored).not.toContain("Comcast"); // never the customer's words
  });

  it("a backfill names its one tracker in the read", async () => {
    ai.text = '{"hits":[]}';
    const { db, filters } = fake({ session: S, trackers: [T[0]], segs: SEGS });
    expect(await scanSmartTrackers("s1", db, { onlyTrackerId: "t1" })).toBe(0);
    expect(filters).toContainEqual(["keyword_trackers", "id", "t1"]);
    expect(filters).toContainEqual(["keyword_trackers", "company_id", "co1"]);
  });

  it("an unreadable answer writes nothing and reports it couldn't run (null)", async () => {
    ai.text = "Sure! Here are the hits";
    const { db, inserts } = fake({ session: S, trackers: T, segs: SEGS });
    expect(await scanSmartTrackers("s1", db)).toBeNull();
    expect(inserts).toEqual([]);
  });

  it("guidance off for this company (suppressed): nothing is written", async () => {
    ai.suppressed = true;
    const { db, inserts } = fake({ session: S, trackers: T, segs: SEGS });
    expect(await scanSmartTrackers("s1", db)).toBe(0);
    expect(inserts).toEqual([]);
  });
});

describe("carrySmartHits", () => {
  it("copies the previous version's smart hits to the new one, except the edited line — no AI call", async () => {
    const prev = [
      { tracker_id: "t1", company_id: "co1", rep_id: "rep1", seq: 3, at_ms: 65000, speaker: "customer", matched: "We're locked into a contract", transcript_version: 2 },
      { tracker_id: "t2", company_id: "co1", rep_id: "rep1", seq: 4, at_ms: null, speaker: "rep", matched: "Can we get you started today", transcript_version: 2 },
    ];
    let reads = 0;
    const inserts: unknown[] = [];
    const from = () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: reads++ === 0 ? prev : [], error: null });
      b.insert = async (rows: unknown) => (inserts.push(rows), { error: null });
      return b;
    };
    await carrySmartHits("s1", 3, 4, { from } as never);
    expect(ai.calls).toEqual([]);
    expect(inserts[0]).toEqual([
      { tracker_id: "t1", session_id: "s1", company_id: "co1", rep_id: "rep1", seq: 3, at_ms: 65000, speaker: "customer", matched: "We're locked into a contract", transcript_version: 3 },
    ]);
  });
});
