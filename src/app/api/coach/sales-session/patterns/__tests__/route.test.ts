import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/patterns — Pattern Interrupt's read, both tabs.
 *
 * WHAT THIS PINS, and why the route had no test until the Rep progress build: the `repProgress`
 * block is a TEAM COMPARISON, and the condition deciding whether to build one is one term away
 * from a condition that looks identical.
 *
 * It was written as `repId ? null : {...}` under a comment claiming it withheld the comparison
 * from reps. It did not: a rep who sends `?scope=team` has no `repId` either, so they would have
 * been handed a one-row "team" ranking them first against nobody — plausible, flattering and
 * false, which is exactly the board the leaderboard build caught itself about to ship.
 *
 * Nothing leaked either way; RLS had already limited the rows. The defect is that a doc-comment
 * described a gate the code did not implement (§2.2 in its quietest form), and only a test that
 * exercises the rep-sends-scope=team path can tell the two apart.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({
  requireSalesCoachManager: vi.fn(),
}));
vi.mock("@/lib/coach/patterns/readPatterns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/coach/patterns/readPatterns")>();
  return { ...actual, readPatterns: vi.fn() };
});

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { readPatterns } from "@/lib/coach/patterns/readPatterns";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import { GET } from "../route";

const mock = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const setCaller = (userId: string | null) =>
  mock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

const row = (over: Partial<PatternRow> = {}): PatternRow =>
  ({
    id: "p1",
    repId: "rep-1",
    itemId: "intro.trucks",
    itemKind: "element",
    label: "Trucks / neighborhood notice",
    section: "INTRODUCTION",
    firstSeen: "2026-09-10T10:00:00Z",
    missesAtDetection: 3,
    applicableAtDetection: 10,
    costPerPitch: 2.3,
    strip: [],
    coachedAt: null,
    fixedAt: null,
    repReviewed: false,
    events: [],
    verdict: { status: "new", open: true, reason: "Detected, not coached yet", streak: 0, comparison: null },
    daysOpen: 9,
    ...over,
  }) as PatternRow;

const setPatterns = (patterns: PatternRow[]) =>
  mock(readPatterns).mockResolvedValue({
    patterns,
    counts: {
      open: patterns.filter((p) => p.verdict.open).length,
      fixed: patterns.filter((p) => !p.verdict.open).length,
      improving: 0,
      isNew: patterns.length,
      stalled: 0,
      openNotImproving: patterns.filter((p) => p.verdict.open).length,
    },
    capped: false,
    scored: true,
  });

const req = (qs = "") =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  setCaller("rep-1");
  setPatterns([row()]);
  mock(requireSalesCoachManager).mockResolvedValue(null);
  mock(createAdminClient).mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) }),
  });
});

describe("authentication", () => {
  it("401s an anonymous caller", async () => {
    setCaller(null);
    expect((await GET(req())).status).toBe(401);
  });
});

describe("the Rep progress block is a manager comparison", () => {
  it("is NULL for a rep asking for their own board", async () => {
    const body = await (await GET(req())).json();
    expect(body.repProgress).toBeNull();
  });

  it("is NULL for a rep who hand-crafts scope=team", async () => {
    // THE REGRESSION THIS FILE EXISTS FOR. `requireSalesCoachManager` returns null for a rep, so
    // the route has the answer — but the block used to be gated on `repId`, which is absent here
    // too. A one-row team ranking this rep first against nobody would have rendered, and RLS
    // would have been perfectly happy about it.
    mock(requireSalesCoachManager).mockResolvedValue(null);
    const body = await (await GET(req("scope=team"))).json();
    expect(body.repProgress).toBeNull();
  });

  it("is built for a manager asking for the team", async () => {
    mock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr", companyId: "co1" });
    const body = await (await GET(req("scope=team"))).json();
    expect(body.repProgress).not.toBeNull();
    expect(body.repProgress.cards.openPatterns).toBe(1);
    expect(body.repProgress.reps).toHaveLength(1);
  });

  it("gives a rep with no chip a row anyway, so fixing everything does not erase you", async () => {
    // `chips` counts OPEN patterns. A rep whose patterns are all fixed has no chip and must still
    // appear in the Rep progress list, reading "On track" — otherwise the people who fixed
    // everything vanish from the board that tracks fixing things.
    mock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr", companyId: "co1" });
    setPatterns([
      row({
        id: "done",
        repId: "rep-2",
        fixedAt: "2026-09-11T10:00:00Z",
        verdict: { status: "fixed", open: false, reason: "5 clean pitches in a row", streak: 5, comparison: null },
      }),
    ]);
    const body = await (await GET(req("scope=team"))).json();
    expect(body.chips).toHaveLength(0);
    expect(body.repProgress.reps.map((r: { repId: string }) => r.repId)).toEqual(["rep-2"]);
    expect(body.repProgress.reps[0].attention).toBe("on_track");
  });
});

describe("a failed read is never an empty board", () => {
  it("500s rather than reporting no patterns", async () => {
    // On this screen a confident zero reads as praise about a rep nobody looked at.
    mock(readPatterns).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Could not load/i);
  });
});

describe("one clock for the whole response", () => {
  it("passes the same instant to the read that the roll-ups use", async () => {
    // "Coached 7 days ago" is a threshold, and a threshold evaluated twice is one that can be
    // crossed between the two evaluations — the rep list and the status pill disagreeing by a day.
    mock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr", companyId: "co1" });
    await GET(req("scope=team"));
    const passed = mock(readPatterns).mock.calls[0]?.[0] as { now?: Date };
    expect(passed.now).toBeInstanceOf(Date);
  });
});
