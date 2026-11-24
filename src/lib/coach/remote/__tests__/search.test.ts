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

// 2026-11-22 (Phase 5 R2 residual): rubric element + grade, talk share, disputed; and hit offsets from the audio clock.
describe("parseCallSearch — the added filters", () => {
  it("rubric element (grade defaults to missed), talk share bounds, disputed", () => {
    expect(parseCallSearch(new URLSearchParams("element=intro.trucks&talkMin=20&talkMax=60&disputed=1"))).toEqual({
      filters: { elementId: "intro.trucks", grade: "missed", talkMin: 20, talkMax: 60, disputed: true },
    });
    expect(parseCallSearch(new URLSearchParams("element=intro.trucks&grade=hit"))).toMatchObject({ filters: { grade: "hit" } });
  });
  it("refuses an unknown element, a bad grade and a talk share outside 0-100", () => {
    expect(parseCallSearch(new URLSearchParams("element=nope"))).toEqual({ error: "Unknown rubric element." });
    // The page offers the phone/video rubric's items; a phone-only one is a real element (2026-11-25).
    expect(parseCallSearch(new URLSearchParams("element=intro.reasonForCall&grade=missed"))).toMatchObject({ filters: { elementId: "intro.reasonForCall" } });
    expect(parseCallSearch(new URLSearchParams("element=intro.trucks&grade=great"))).toEqual({ error: "Grade must be hit, partial or missed." });
    expect(parseCallSearch(new URLSearchParams("talkMin=120"))).toEqual({ error: "Talk share is a percent from 0 to 100." });
  });
});

describe("runCallSearch — the added filters", () => {
  const sessions = [
    { id: "s1", agent_id: "r1", context: "phone", client_label: "Acme", started_at: "2026-11-20T10:00:00Z", audio_started_at: null, outcome: "sold" },
    { id: "s2", agent_id: "r1", context: "video", client_label: "Beta", started_at: "2026-11-19T10:00:00Z", audio_started_at: null, outcome: null },
  ];
  it("rubric element + grade narrows the calls to those whose pitch got that grade", async () => {
    const { db, calls } = fakeDb({ pitch_score_elements: [{ pitch_id: "p1" }], pitch_scores: [{ id: "p1", session_id: "s1", total: 70 }], coaching_sessions: sessions, profiles: [] });
    await runCallSearch(db, { elementId: "intro.trucks", grade: "missed" });
    expect(calls).toContainEqual(["pitch_score_elements", "eq", ["element_id", "intro.trucks"]]);
    expect(calls).toContainEqual(["pitch_score_elements", "eq", ["grade", "missed"]]);
    expect(calls).toContainEqual(["coaching_sessions", "in", ["id", ["s1"]]]);
  });
  it("no pitch got that grade → no calls, without reading sessions", async () => {
    const { db, calls } = fakeDb({ pitch_score_elements: [] });
    expect(await runCallSearch(db, { elementId: "intro.trucks", grade: "hit" })).toEqual({ ok: true, rows: [], truncated: false });
    expect(calls.some(([t]) => t === "coaching_sessions")).toBe(false);
  });
  it("disputed narrows to the calls the dispute events name", async () => {
    const { db, calls } = fakeDb({ events: [{ payload: { session_id: "s2", pitch_id: "p2" } }, { payload: {} }], coaching_sessions: sessions, profiles: [] });
    await runCallSearch(db, { disputed: true });
    expect(calls).toContainEqual(["events", "eq", ["kind", "coach.pitch_score_disputed"]]);
    expect(calls).toContainEqual(["coaching_sessions", "in", ["id", ["s2"]]]);
  });
  it("talk share uses the newest transcript version, and a call with no measured share is left out", async () => {
    const { db } = fakeDb({
      coaching_sessions: sessions,
      session_interaction_stats: [
        { session_id: "s1", transcript_version: 1, talk_ratio_time: 0.9 },
        { session_id: "s1", transcript_version: 2, talk_ratio_time: 0.4 },
      ],
      profiles: [],
    });
    const r = await runCallSearch(db, { talkMin: 30, talkMax: 50 });
    expect(r.ok && r.rows.map((x) => x.sessionId)).toEqual(["s1"]);
  });
  it("hit offsets are measured from the recording's own start when known (0300)", async () => {
    const { db } = fakeDb({
      coaching_transcript_segments_current: [{ session_id: "s1", seq: 1, speaker: "rep", text: "price", spoken_at: "2026-11-20T10:01:00Z" }],
      coaching_sessions: [{ ...sessions[0], audio_started_at: "2026-11-20T10:00:56Z" }],
      profiles: [],
    });
    const r = await runCallSearch(db, { q: "price" });
    expect(r.ok && r.rows[0]!.hits[0]!.atMs).toBe(4_000);
  });
});

describe("topic or competitor filter (Gong F11.12)", () => {
  it("parses a topic, lower-cased, and refuses a long one", async () => {
    const { parseCallSearch } = await import("../search");
    expect(parseCallSearch(new URLSearchParams("topic=  Pricing "))).toEqual({ filters: { topic: "pricing" } });
    expect(parseCallSearch(new URLSearchParams(`topic=${"x".repeat(61)}`))).toEqual({ error: "Keep the topic under 60 characters." });
  });

  it("matches the LATEST intel read per call, on topics or competitors, by substring", async () => {
    const { sessionsWithTopic } = await import("../search");
    const evs = [
      // newest first, as the route reads them
      { subject: "sales_session:a", payload: { intel: { topics: ["contract length"], competitors: [] } } },
      { subject: "sales_session:a", payload: { intel: { topics: ["pricing"], competitors: [] } } }, // older read of a — ignored
      { subject: "sales_session:b", payload: { intel: { topics: ["installation"], competitors: ["Spectrum"] } } },
      { subject: "sales_session:c", payload: { intel: { topics: ["Pricing tiers"], competitors: [] } } },
      { subject: "pitch:zzz", payload: { intel: { topics: ["pricing"] } } }, // not a call
      { subject: "sales_session:d", payload: null },
    ];
    expect([...sessionsWithTopic(evs, "pric")].sort()).toEqual(["c"]);
    expect([...sessionsWithTopic(evs, "spectrum")]).toEqual(["b"]);
    expect(sessionsWithTopic(evs, "nothing").size).toBe(0);
  });
});
