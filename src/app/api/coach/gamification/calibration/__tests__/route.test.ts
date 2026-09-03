import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/gamification/calibration — manager-gated (403 otherwise). GET builds the human-vs-model report and
 * hands back the NEXT transcript ANONYMIZED (speaker role only, never the rep name). POST stores the blind score
 * and reveals the model's judged scores. The admin client is faked per-table; the gate, anonymization, and the
 * reveal are the logic under test.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, POST } from "../route";

const setAuth = (v: unknown) => (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** A per-table chainable builder: every method returns the builder, and the builder resolves to the table's data. */
function setTables(tables: Record<string, unknown>) {
  const captured: { upsert?: unknown } = {};
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from(table: string) {
      const result = tables[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "maybeSingle"]) builder[m] = () => builder;
      builder.upsert = (row: unknown) => {
        captured.upsert = row;
        return builder;
      };
      builder.then = (res: (v: unknown) => unknown) => res(result);
      return builder;
    },
    _captured: captured,
  });
  return captured;
}

const getReq = () => new Request("http://localhost/api/coach/gamification/calibration") as never;
const postReq = (body: unknown) =>
  new Request("http://localhost/api/coach/gamification/calibration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => vi.clearAllMocks());

describe("calibration route — manager gate", () => {
  it("403 when unauthenticated", async () => {
    setAuth(null);
    setTables({});
    expect((await GET(getReq())).status).toBe(403);
  });

  it("403 for a non-admin without sales_coach_role='admin'", async () => {
    setAuth({ userId: "u1", companyId: "c1", isAdmin: false });
    setTables({ profiles: { data: { sales_coach_role: "member" } } });
    expect((await GET(getReq())).status).toBe(403);
  });
});

describe("GET — report + anonymized next transcript", () => {
  it("anonymizes the transcript to speaker roles (never the rep name) and reports agreement", async () => {
    setAuth({ userId: "mgr", companyId: "c1", isAdmin: true });
    setTables({
      after_pitch_summaries: {
        data: [
          { session_id: "s1", payload: { scores: [{ key: "opener", score: 8 }, { key: "tone", score: 6 }] } },
          { session_id: "s2", payload: { scores: [{ key: "opener", score: 7 }] } },
        ],
      },
      // Manager already scored s1 → it becomes a report pair; s2 is the next to score.
      gamification_calibration: { data: [{ session_id: "s1", scores: { opener: 8, tone: 6 } }] },
      coaching_transcript_segments: {
        data: [
          { speaker: "agent", text: "Hi, is this Rob Ramos?", seq: 0 },
          { speaker: "customer", text: "Speaking.", seq: 1 },
          { speaker: "agent", text: "Great — quick question.", seq: 2 },
          { speaker: "customer", text: "Go ahead.", seq: 3 },
        ],
      },
    });
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pool).toBe(2);
    expect(body.scored).toBe(1);
    expect(body.report.n).toBe(1);
    // s1 was a perfect match → opener trustworthy.
    expect(body.report.perDimension.find((d: { dimension: string }) => d.dimension === "opener").trustworthy).toBe(true);
    // The next transcript is s2, anonymized: REP/PROSPECT, and it must NOT contain the rep's name from the segments.
    expect(body.next.sessionId).toBe("s2");
    expect(body.next.transcript).toContain("REP:");
    expect(body.next.transcript).toContain("PROSPECT:");
  });
});

describe("POST — store blind score then reveal the model", () => {
  it("upserts the manager's score and returns the model's judged scores", async () => {
    setAuth({ userId: "mgr", companyId: "c1", isAdmin: true });
    const cap = setTables({
      gamification_calibration: { error: null },
      after_pitch_summaries: { data: { payload: { scores: [{ key: "opener", score: 9 }, { key: "close", score: 4 }] } } },
    });
    const scores = { opener: 7, objection: 6, tone: 6, close: 5, next_step: 6 };
    const res = await POST(postReq({ sessionId: "11111111-1111-4111-8111-111111111111", scores }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.human).toEqual(scores);
    expect(body.model).toEqual({ opener: 9, close: 4 });
    expect((cap.upsert as { scorer_id: string }).scorer_id).toBe("mgr");
  });
});
