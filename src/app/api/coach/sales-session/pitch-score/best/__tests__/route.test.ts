import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/pitch-score/best.
 *
 * The Progress board draws three best-pitch cards and nothing served them. `aggregatePitches` gives
 * `bestPitchScore` — one number from `reduce(Math.max)` — which is enough for the gauge and carries
 * no list, no dates and no ids, so the mobile board shipped without the cards rather than inventing
 * them.
 *
 * Three rules carry the weight here, and each is a way to be plausibly wrong:
 *
 *   1. QUALIFYING ONLY. A rep's "best" must mean the same thing their total means.
 *   2. RANKED BY TOTAL, not base — the bonus is part of the score they compete on.
 *   3. THE CALLER'S OWN pitches by default, or a manager's request ranks the company and calls it
 *      one person's.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ tag: "cookie" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));

import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const ME = "rep-me";

/** Records every filter the route applies, so the rules can be asserted rather than inferred. */
function db(rows: unknown[] | null, error: { message: string } | null = null) {
  const calls: Record<string, unknown> = { eq: {}, gte: null, order: null, orders: [], limit: null };
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (col: string, val: unknown) => {
    (calls.eq as Record<string, unknown>)[col] = val;
    return q;
  };
  q.gte = (_col: string, val: unknown) => {
    calls.gte = val;
    return q;
  };
  q.order = (col: string, opts: { ascending: boolean }) => {
    calls.order = calls.order ?? { col, ...opts };
    (calls.orders as unknown[]).push({ col, ...opts });
    return q;
  };
  q.limit = (n: number) => {
    calls.limit = n;
    return q;
  };
  (q as { then: unknown }).then = (res: (v: unknown) => unknown) =>
    Promise.resolve(res({ data: rows, error }));
  return { client: { from: () => q }, calls };
}

const req = (qs = "") =>
  ({
    nextUrl: { searchParams: new URLSearchParams(qs) },
    url: `https://x.test/api/coach/sales-session/pitch-score/best?${qs}`,
    headers: new Headers(),
  }) as never;

describe("GET /pitch-score/best", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(rateLimit).mockReturnValue(null);
    asMock(resolveApiAuth).mockResolvedValue({ userId: ME, companyId: "co" });
  });

  it("refuses an unauthenticated caller", async () => {
    asMock(resolveApiAuth).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("returns only QUALIFYING pitches, ranked by total, three by default", async () => {
    /*
      All three rules in one read. Ranking by BASE would put a disciplined pitch above a higher-
      scoring one, and including non-qualifying pitches would celebrate a pitch that contributed
      nothing to the total printed beside it.
    */
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req());
    expect((calls.eq as Record<string, unknown>).qualifying).toBe(true);
    expect(calls.order).toEqual({ col: "total", ascending: false });
    expect(calls.limit).toBe(3);
  });

  it("breaks a tie deterministically, because the cards are tappable", async () => {
    /*
      Ranked on total alone, two pitches with the same score order however Postgres feels, and the
      order can differ between reads. Harmless for a number; not harmless for a LINK — a rep taps
      "97 points" expecting the pitch they were looking at and opens a different one. Found by
      opening the residual that said this did not matter.
    */
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req());
    expect(calls.orders).toEqual([
      { col: "total", ascending: false },
      { col: "recorded_at", ascending: false },
    ]);
  });

  it("defaults to the caller's own pitches", async () => {
    // Without this a manager's request with no repId ranks the whole company and presents the result
    // as one person's best work.
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req());
    expect((calls.eq as Record<string, unknown>).rep_id).toBe(ME);
  });

  it("honours an explicit repId, which RLS still has to allow", async () => {
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req("repId=someone-else"));
    expect((calls.eq as Record<string, unknown>).rep_id).toBe("someone-else");
  });

  it("bounds the limit rather than trusting it", async () => {
    // A caller asking for the whole history gets ten. Unbounded, this becomes a cheap way to pull
    // every score a token can see.
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req("limit=500"));
    expect(calls.limit).toBe(10);
  });

  it("ignores a nonsense limit instead of returning nothing", async () => {
    const { client, calls } = db([]);
    asMock(createClient).mockResolvedValue(client);
    await GET(req("limit=abc"));
    expect(calls.limit).toBe(3);
  });

  it("falls back to week on an unknown period, and all time has no lower bound", async () => {
    const unknown = db([]);
    asMock(createClient).mockResolvedValue(unknown.client);
    const res = await GET(req("period=all_time"));
    expect((await res.json()).period).toBe("week");
    expect(unknown.calls.gte).not.toBeNull();

    const all = db([]);
    asMock(createClient).mockResolvedValue(all.client);
    await GET(req("period=all"));
    expect(all.calls.gte).toBeNull();
  });

  it("returns a pitch whose session was deleted, with a null link", async () => {
    /*
      `session_id` is `on delete set null`. The SCORE is real and a rep's best pitch does not stop
      existing when its recording is purged — so the row survives and the client renders a card with
      no tap rather than a tap that goes nowhere.
    */
    const { client } = db([
      { id: "p1", session_id: null, recorded_at: "2026-09-18T16:12:00Z", total: 106.5, outcome: "sold" },
    ]);
    asMock(createClient).mockResolvedValue(client);
    const body = await (await GET(req())).json();
    expect(body.pitches).toHaveLength(1);
    expect(body.pitches[0].sessionId).toBeNull();
    expect(body.pitches[0].total).toBe(106.5);
  });

  it("a failed read is a 500, never an empty list", async () => {
    /*
      INV22. An empty list means "you have no counted pitches", which is a real and discouraging
      statement. A failed read means nothing of the kind, and rendering one as the other is the
      confident-zero failure this product keeps finding.
    */
    const { client } = db(null, { message: "boom" });
    asMock(createClient).mockResolvedValue(client);
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).pitches).toBeUndefined();
  });
});
