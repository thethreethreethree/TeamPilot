import { describe, it, expect, vi } from "vitest";
import { callSearchCsv, parseCallSearch, runCallSearch, type CallSearchRow } from "../search";

vi.mock("@/lib/coach/v5/nonSalesSubjects", () => ({ NON_SALES_KINDS: ["meeting", "huddle"] }));

describe("parseCallSearch", () => {
  it("keeps valid filters and drops 'all'", () => {
    const r = parseCallSearch(new URLSearchParams("q=contract&channel=phone&outcome=all&scoreMin=40&from=2026-11-01"));
    expect(r).toEqual({ filters: { q: "contract", channel: "phone", scoreMin: 40, from: "2026-11-01T00:00:00.000Z" } });
  });
  it("refuses unknown channel/outcome, bad ids, non-dates, non-numbers and long queries", () => {
    for (const q of ["channel=fax", "outcome=maybe", "rep=x", "tracker=1", "from=never", "scoreMax=lots", `q=${"a".repeat(201)}`]) {
      expect(parseCallSearch(new URLSearchParams(q))).toHaveProperty("error");
    }
  });
});

describe("callSearchCsv", () => {
  it("goes through toCsv: quotes where needed, doubles quotes and neutralises formula-leading cells", () => {
    const row: CallSearchRow = {
      sessionId: "s1", repId: "r", repName: "=HYPERLINK(\"x\")", channel: "phone", callLabel: 'Acme "big"', startedAt: "2026-11-20",
      outcome: "sold", score: 72, hits: [{ seq: 1, speaker: "rep", text: "-5% off", atMs: 0 }],
    };
    const [head, line] = callSearchCsv([row]).trim().split("\r\n");
    expect(head).toBe("Date,Rep,Channel,Call,Outcome,Score,Matching lines,Session id");
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain('"Acme ""big"""');
    expect(line).toContain(`'-5% off`);
    expect(line).toContain(",72,"); // a number stays a number
  });
});

/** A fake caller client: records calls, returns canned rows per table. */
function fakeDb(tables: Record<string, unknown[]>) {
  const calls: Array<[string, string, unknown[]]> = [];
  const db = {
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "textSearch", "order", "limit", "not", "in", "eq", "gte", "lte"]) {
        b[m] = (...a: unknown[]) => {
          calls.push([t, m, a]);
          return b;
        };
      }
      b.then = (res: (v: unknown) => unknown) => res({ data: tables[t] ?? [], error: null });
      return b;
    },
  };
  return { db: db as never, calls };
}

describe("runCallSearch", () => {
  it("words → matching calls with hits as offsets into the call; sales calls only; score bounds apply", async () => {
    const { db, calls } = fakeDb({
      coaching_transcript_segments_current: [
        { session_id: "s1", seq: 3, speaker: "customer", text: "send the contract", spoken_at: "2026-11-20T10:01:00Z" },
        { session_id: "s2", seq: 1, speaker: "rep", text: "contract terms", spoken_at: null },
      ],
      coaching_sessions: [
        { id: "s1", agent_id: "r1", context: "phone", client_label: "Acme", started_at: "2026-11-20T10:00:00Z", outcome: "sold" },
        { id: "s2", agent_id: "r1", context: "video", client_label: "Beta", started_at: "2026-11-19T10:00:00Z", outcome: null },
      ],
      pitch_scores: [{ session_id: "s1", total: 80 }, { session_id: "s2", total: 30 }],
      profiles: [{ id: "r1", full_name: "Rae" }],
    });
    const r = await runCallSearch(db, { q: "contract", scoreMin: 50 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.sessionId)).toEqual(["s1"]);
    expect(r.rows[0]!.hits[0]).toMatchObject({ atMs: 60_000, text: "send the contract" });
    expect(calls).toContainEqual(["coaching_transcript_segments_current", "textSearch", ["text", "contract", { config: "simple", type: "websearch" }]]);
    expect(calls).toContainEqual(["coaching_sessions", "not", ["session_kind", "in", "(meeting,huddle)"]]);
  });
  it("no transcript match → no calls, without reading sessions", async () => {
    const { db, calls } = fakeDb({});
    expect(await runCallSearch(db, { q: "nothing" })).toEqual({ ok: true, rows: [], truncated: false });
    expect(calls.some(([t]) => t === "coaching_sessions")).toBe(false);
  });
});
