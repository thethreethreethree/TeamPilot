import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/dashboard — the Sales Coach home stats. Previously untested.
 *
 * The behaviour worth pinning is the HONEST-ERROR-STATE (audit 2026-07-09): sessionsData drives
 * every stat, so if that read (or the reviews read) FAILS, the route must NOT return all-zeros as if the
 * rep had no activity — that would make the surface lie about team health on a transient DB hiccup ("the
 * rep did nothing" when the read just broke). It returns 500 so the page hides the stat cards instead.
 * Plus the auth gate and a happy-path stat computation.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCueRelianceSeries: vi.fn(async () => []) }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

function fakeSb(o: {
  user?: { id: string } | null;
  sessions?: Array<{ id: string; status: string; started_at: string }> | null;
  sessionsErr?: unknown;
  cuesCount?: number;
  reviews?: unknown[];
  reviewsErr?: unknown;
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: o.user === undefined ? { id: "rep1" } : o.user } }),
    },
    from: (t: string) => {
      if (t === "coaching_sessions") {
        // The route now pages the agent's sessions via fetchAllPaged (was an unbounded .select) — the chain
        // ends on .order().range(): page 0 returns the rows (or throws via `error`), page 1+ returns [].
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async (from: number) => ({
                  data: from > 0 ? [] : (o.sessions ?? null),
                  error: o.sessionsErr ?? null,
                }),
              }),
            }),
          }),
        };
      }
      if (t === "coaching_cues") {
        return { select: () => ({ in: async () => ({ count: o.cuesCount ?? 0 }) }) };
      }
      if (t === "events") {
        // Reviews are now PAGED (fetchAllPaged): actor=agent, kind=review, .order("id").range().
        // page 0 → o.reviews (or throws via error), page 1+ → [].
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  range: async (from: number) => ({
                    data: from > 0 ? [] : (o.reviews ?? []),
                    error: o.reviewsErr ?? null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  };
}

const mock = (sb: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/coach/sales-session/dashboard", () => {
  it("401 when unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await GET()).status).toBe(401);
  });

  it("500 (honest error, NOT a fake all-zeros readout) when the sessions read fails", async () => {
    mock(fakeSb({ sessionsErr: { message: "internal pg detail" } }));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("200 with computed stats on the happy path", async () => {
    mock(
      fakeSb({
        sessions: [
          { id: "s1", status: "active", started_at: new Date().toISOString() },
          { id: "s2", status: "ended", started_at: new Date().toISOString() },
        ],
        cuesCount: 4,
        // s2 has a review EVENT → reviewed (status is 'ended', never 'reviewed').
        reviews: [{ subject: "sales_session:s2", payload: {}, created_at: new Date().toISOString() }],
      })
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.sessionsTotal).toBe(2);
    expect(body.stats.activeCount).toBe(1);
    expect(body.stats.reviewedCount).toBe(1);
    expect(body.stats.awaitingReview).toBe(0); // s2 is reviewed → drained from awaiting
    expect(body.stats.cuesTotal).toBe(4);
  });

  it("REGRESSION (finding 3): reviewed comes from the durable event, NOT a status='reviewed' nothing writes", async () => {
    // Two ENDED sessions, one with a review event, one without. Old logic keyed on status='reviewed' → always 0
    // reviewed + both awaiting forever. New logic: one reviewed, one awaiting (generating a review DRAINS it).
    mock(
      fakeSb({
        sessions: [
          { id: "s1", status: "ended", started_at: new Date().toISOString() },
          { id: "s2", status: "ended", started_at: new Date().toISOString() },
        ],
        reviews: [{ subject: "sales_session:s1", payload: {}, created_at: new Date().toISOString() }],
      })
    );
    const body = await (await GET()).json();
    expect(body.stats.reviewedCount).toBe(1);
    expect(body.stats.awaitingReview).toBe(1);
  });

  it("REGRESSION (finding 11): reviewsGenerated counts DISTINCT sessions — regeneration can't exceed sessions", async () => {
    // One ended session, reviewed TWICE (two review events, same subject). reviewsGenerated must be 1, not 2.
    mock(
      fakeSb({
        sessions: [{ id: "s1", status: "ended", started_at: new Date().toISOString() }],
        reviews: [
          { subject: "sales_session:s1", payload: {}, created_at: "2026-08-14T01:00:00Z" },
          { subject: "sales_session:s1", payload: {}, created_at: "2026-08-14T02:00:00Z" },
        ],
      })
    );
    const body = await (await GET()).json();
    expect(body.stats.reviewsGenerated).toBe(1);
    expect(body.stats.reviewsGenerated).toBeLessThanOrEqual(body.stats.sessionsTotal);
  });

  it("500 when the reviews read fails (honest error, not a fake readout)", async () => {
    mock(
      fakeSb({
        sessions: [{ id: "s1", status: "ended", started_at: new Date().toISOString() }],
        reviewsErr: { message: "pg detail" },
      })
    );
    expect((await GET()).status).toBe(500);
  });
});
