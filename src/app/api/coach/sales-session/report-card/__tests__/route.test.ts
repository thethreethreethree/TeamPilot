import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/report-card — Pitch Performance data.
 *
 * The one behavior these tests pin is the honesty fix (audit 2026-08-19): the pitch read now captures its error
 * and returns a real 500, instead of swallowing it and returning 200 with pitches:[] — which read as a false
 * "no pitches" and made a rep think their recordings vanished (the pitch_analyses(summary) join enlarged the
 * failure surface). A regression that drops the `if (pitchErr)` guard fails the first test.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

function fakeSb(opts: { user?: { id: string } | null; pitches?: unknown[]; pitchErr?: unknown }) {
  const { user = { id: "u1" }, pitches = [], pitchErr = null } = opts;
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      // The route reads ONLY `pitches` now — the rep_pattern_summaries read moved to Today's Metrics. A mock
      // branch for any other table would be dead; an unexpected table is a real regression, so throw.
      if (table === "pitches") {
        // .select().eq().order().limit(200) is awaited → { data, error }.
        const result = { data: pitches, error: pitchErr };
        const limitThenable = { then: (resolve: (v: unknown) => void) => resolve(result) };
        return { select: () => ({ eq: () => ({ order: () => ({ limit: () => limitThenable }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

// The route no longer reads a period param (the pitch list was never period-scoped); an empty query is faithful.
function req() {
  return { nextUrl: { searchParams: new URLSearchParams() } } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => vi.clearAllMocks());

describe("report-card route — honest pitch-read failure", () => {
  it("a pitch read ERROR returns 500, not a false 200-with-empty-pitches", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({ pitchErr: { message: "relation error" } }),
    );
    const res = await GET(req());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(json.pitches).toBeUndefined(); // must NOT hand back an empty list as if it were real
  });

  it("a successful read returns 200 with the pitches + their after-pitch summary", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeSb({
        pitches: [
          {
            id: "p1",
            name: "Blue door",
            status: "complete",
            recorded_at: "2026-08-19T15:00:00Z",
            door_knocks: { outcome: "sold" },
            pitch_analyses: { summary: "Strong open, rushed the close." },
          },
        ],
      }),
    );
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pitches).toHaveLength(1);
    expect(json.pitches[0].outcome).toBe("sold");
    expect(json.pitches[0].summary).toBe("Strong open, rushed the close.");
  });

  it("401 when unauthenticated", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSb({ user: null }));
    expect((await GET(req())).status).toBe(401);
  });
});
