import { describe, it, expect } from "vitest";
import { dealSentimentFrom, readDealSentiment } from "../dealSentiment";

describe("dealSentimentFrom", () => {
  it("no reading → null; one → last with no trend", () => {
    expect(dealSentimentFrom([])).toBeNull();
    expect(dealSentimentFrom(["cooling"])).toEqual({ last: "cooling", trend: null, calls: 1 });
  });
  it("trend compares the last call with the one before it", () => {
    expect(dealSentimentFrom(["cooling", "warming"])).toMatchObject({ last: "warming", trend: "warming" });
    expect(dealSentimentFrom(["warming", "warming", "flat"])).toMatchObject({ last: "flat", trend: "cooling", calls: 3 });
    expect(dealSentimentFrom(["flat", "flat"])).toMatchObject({ trend: "steady" });
  });
});

const moments = (...s: string[]) => ({ moments: s.map((x) => ({ sentiment: x, text: "t" })) });
function db(tables: Record<string, { data?: unknown[]; error?: unknown }>, seen: { subjects: string[][] } = { subjects: [] }) {
  return {
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) b[m] = () => b;
      b.in = (c: string, v: string[]) => {
        if (c === "subject") seen.subjects.push(v);
        return b;
      };
      b.range = async (from: number) => (from === 0 ? { data: tables[t]?.data ?? [], error: tables[t]?.error ?? null } : { data: [], error: null });
      return b;
    },
  } as never;
}

describe("readDealSentiment", () => {
  it("reads each call's LATEST moments, orders calls by time, and derives the deal's sentiment", async () => {
    const m = await readDealSentiment(
      db({
        remote_prospect_calls: { data: [{ prospect_id: "p1", session_id: "s1" }, { prospect_id: "p1", session_id: "s2" }, { prospect_id: "p2", session_id: "s3" }] },
        events: {
          data: [
            { subject: "sales_session:s2", payload: moments("cooling", "cooling"), created_at: "2026-11-20T00:00:00Z", id: "e3" },
            { subject: "sales_session:s1", payload: moments("warming"), created_at: "2026-11-10T00:00:00Z", id: "e2" },
            { subject: "sales_session:s1", payload: moments("cooling"), created_at: "2026-11-09T00:00:00Z", id: "e1" }, // older version of s1
          ],
        },
      }),
      ["p1", "p2"],
    );
    expect(m!.get("p1")).toEqual({ last: "cooling", trend: "cooling", calls: 2 });
    expect(m!.has("p2")).toBe(false); // its call has no reading
  });
  it("a failed read is null, never 'no sentiment'", async () => {
    expect(await readDealSentiment(db({ remote_prospect_calls: { error: { message: "x" } } }), ["p1"])).toBeNull();
    expect(await readDealSentiment(db({ remote_prospect_calls: { data: [{ prospect_id: "p1", session_id: "s1" }] }, events: { error: { message: "x" } } }), ["p1"])).toBeNull();
  });
  it("asks for at most 100 calls per request", async () => {
    const seen = { subjects: [] as string[][] };
    const links = Array.from({ length: 250 }, (_, i) => ({ prospect_id: "p1", session_id: `s${i}` }));
    await readDealSentiment(db({ remote_prospect_calls: { data: links }, events: { data: [] } }, seen), ["p1"]);
    expect(seen.subjects.map((s) => s.length)).toEqual([100, 100, 50]);
  });
});
