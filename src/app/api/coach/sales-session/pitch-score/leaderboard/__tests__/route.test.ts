import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/pitch-score/leaderboard.
 *
 * This route reads with the SERVICE ROLE, which has no RLS, so every protection it has is one it
 * performs itself. Two of them fail silently if removed:
 *
 *   1. The company filter. Without it the read returns every pitch on the instance and the board
 *      ranks strangers together — no error, no empty result, just a plausible wrong board.
 *   2. The rep/manager split. A rep must never receive another rep's name or total. The database
 *      would normally stop that; here it cannot, because the service role bypassed it.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/callerCompanyId", () => ({ callerCompanyId: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/coach/pitchScore/readPitchPeriod", () => ({ readPitchPeriod: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchPeriod } from "@/lib/coach/pitchScore/readPitchPeriod";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const ME = "rep-me";
const OTHER = "rep-other";

const req = (period = "all") =>
  new Request(
    `https://x.test/api/coach/sales-session/pitch-score/leaderboard?period=${period}`
  ) as never;

/** A qualifying pitch worth `total`, attributed to `repId`. */
const pitch = (repId: string, total: number) => ({
  repId,
  score: {
    base: 45,
    bonus: 0,
    violations: 0,
    total,
    qualifying: true,
    notQualifyingReason: null,
    sectionPoints: {
      introduction: 0, discovery: 0, consulting: 0, close: 0, transitions: 0, delivery: 0,
    },
    bonusBreakdown: [],
    violationBreakdown: [],
  },
  elements: [],
});

/** The profiles lookup for the manager view. */
let profileRows: Array<{ id: string; full_name: string | null }>;
let profileFilters: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  asMock(rateLimit).mockReturnValue(null);
  asMock(resolveApiAuth).mockResolvedValue({ userId: ME, companyId: "co1" });
  asMock(requireSalesCoachManager).mockResolvedValue(null);
  asMock(callerCompanyId).mockResolvedValue("co1");
  asMock(readPitchPeriod).mockResolvedValue({
    pitches: [pitch(OTHER, 90), pitch(ME, 60), pitch(ME, 10)],
    skippedPreVerdict: 0,
  });

  profileRows = [
    { id: ME, full_name: "Me Myself" },
    { id: OTHER, full_name: "Someone Else" },
  ];
  profileFilters = {};
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, val: unknown) => { profileFilters[col] = val; return chain; };
  chain.in = async (col: string, val: unknown) => {
    profileFilters[col] = val;
    return { data: profileRows, error: null };
  };
  asMock(createAdminClient).mockReturnValue({ from: () => chain });
});

describe("the company filter is not optional on a service-role read", () => {
  it("scopes the read to the caller's proven company", async () => {
    await GET(req());
    const args = asMock(readPitchPeriod).mock.calls[0]![0] as { companyId?: string };
    // Without this the read crosses every tenant on the instance and the board ranks strangers
    // together. There is no error to notice — only a plausible wrong board.
    expect(args.companyId).toBe("co1");
  });

  it("uses the manager's proven company rather than re-resolving it", async () => {
    asMock(requireSalesCoachManager).mockResolvedValue({ userId: ME, companyId: "co-mgr" });
    await GET(req());
    expect((asMock(readPitchPeriod).mock.calls[0]![0] as { companyId?: string }).companyId)
      .toBe("co-mgr");
    expect(callerCompanyId).not.toHaveBeenCalled();
  });

  it("refuses when no company can be established, rather than reading unscoped", async () => {
    asMock(callerCompanyId).mockResolvedValue(undefined);
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(readPitchPeriod).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller before anything is read", async () => {
    asMock(resolveApiAuth).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(readPitchPeriod).not.toHaveBeenCalled();
  });
});

describe("a rep gets their standing, never the field", () => {
  it("returns no rows at all", async () => {
    const body = await (await GET(req())).json();
    expect(body.managerView).toBe(false);
    expect(body.rows).toBeUndefined();
    // The stronger assertion: the other rep's name and total appear NOWHERE in the payload.
    const wire = JSON.stringify(body);
    expect(wire).not.toContain(OTHER);
    expect(wire).not.toContain("Someone Else");
    expect(wire).not.toContain("90");
    // And no ranking of any kind, which is the founder ruling rather than only a privacy measure.
    expect(wire).not.toMatch(/"rank"|"boardSize"/);
  });

  it("withholds the rank and the size of the field", async () => {
    // Founder ruling 2026-09-22: the KPI document wins on anything a rep sees, and it calls
    // cross-agent ranking manager-only. Stripped at the SERVER, so a rendering bug cannot expose
    // a value that never left it.
    const body = await (await GET(req())).json();
    expect(body.standing.rank).toBeUndefined();
    expect(body.boardSize).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/"rank"/);
  });

  it("still gives them their own totals", async () => {
    // Me: 60 + 10 = 70 from two counted pitches. Their own numbers are not cross-agent ranking.
    const body = await (await GET(req())).json();
    expect(body.standing).toMatchObject({ repId: ME, total_points: 70, counted: 2 });
  });

  it("gives the distance to close, and not the cushion below", async () => {
    // THREE reps, with ME in the middle — so there genuinely IS someone below. The default fixture
    // puts ME last, where `ahead` is null anyway and a route that leaked the cushion would look
    // identical. A mutation proved that; this fixture is the fix.
    asMock(readPitchPeriod).mockResolvedValue({
      pitches: [pitch(OTHER, 90), pitch(ME, 70), pitch("rep-below", 25)],
      skippedPreVerdict: 0,
    });
    const body = await (await GET(req())).json();
    // A target they can close by pitching better.
    expect(body.gaps.behind).toBe(20);
    // A position to defend, which is the stress machine the KPI document names. There IS a rep
    // 45 points below; the rep is not told.
    expect(body.gaps.ahead).toBeNull();
    expect(JSON.stringify(body)).not.toContain("45");
  });

  it("returns a null standing when they have no scored pitch", async () => {
    asMock(readPitchPeriod).mockResolvedValue({
      pitches: [pitch(OTHER, 90)],
      skippedPreVerdict: 0,
    });
    const body = await (await GET(req())).json();
    // Null, not a zero row — and still no field size, which would tell them how many people they
    // are not competing against.
    expect(body.standing).toBeNull();
    expect(body.boardSize).toBeUndefined();
  });

  it("does not look up names for a rep", async () => {
    await GET(req());
    expect(profileFilters).toEqual({});
  });
});

describe("a manager gets the board", () => {
  beforeEach(() => {
    asMock(requireSalesCoachManager).mockResolvedValue({ userId: ME, companyId: "co1" });
  });

  it("returns every rep, ranked, highest total first", async () => {
    const body = await (await GET(req())).json();
    expect(body.managerView).toBe(true);
    expect(body.rows.map((r: { repId: string }) => r.repId)).toEqual([OTHER, ME]);
    expect(body.rows.map((r: { rank: number }) => r.rank)).toEqual([1, 2]);
  });

  it("names them, scoped to the same company and to the ids already on the board", async () => {
    const body = await (await GET(req())).json();
    expect(body.rows[0].fullName).toBe("Someone Else");
    // Not a roster read: both filters are applied, so a manager learns the names of people whose
    // scores they can already see and nobody else.
    expect(profileFilters.company_id).toBe("co1");
    expect(profileFilters.id).toEqual([OTHER, ME]);
  });

  it("degrades to ids rather than withholding the scores when names fail", async () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.in = async () => ({ data: null, error: { message: "permission denied for profiles" } });
    asMock(createAdminClient).mockReturnValue({ from: () => chain });

    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows[0].fullName).toBeNull();
    expect(body.rows[0].total_points).toBe(90);
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/permission denied/i);
  });
});

describe("a failed read is not an empty board", () => {
  it("returns 500 rather than telling a team nobody scored", async () => {
    asMock(readPitchPeriod).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(500);
    // The error-as-no-data class: an empty board is something a manager acts on by assuming the
    // team did nothing, which is the worst possible response to a board that merely failed to load.
    expect(JSON.stringify(await res.json())).not.toMatch(/\[\]/);
  });
});

describe("the period", () => {
  it("passes a window for week and month", async () => {
    await GET(req("week"));
    const week = (asMock(readPitchPeriod).mock.calls[0]![0] as { from?: string }).from;
    expect(typeof week).toBe("string");

    vi.clearAllMocks();
    asMock(rateLimit).mockReturnValue(null);
    asMock(resolveApiAuth).mockResolvedValue({ userId: ME, companyId: "co1" });
    asMock(requireSalesCoachManager).mockResolvedValue(null);
    asMock(callerCompanyId).mockResolvedValue("co1");
    asMock(readPitchPeriod).mockResolvedValue({ pitches: [], skippedPreVerdict: 0 });
    await GET(req("month"));
    const month = (asMock(readPitchPeriod).mock.calls[0]![0] as { from?: string }).from;
    expect(new Date(month!).getTime()).toBeLessThan(new Date(week!).getTime());
  });

  it("treats an unknown period as all time rather than erroring", async () => {
    const body = await (await GET(req("fortnight"))).json();
    expect(body.period).toBe("all");
    expect((asMock(readPitchPeriod).mock.calls[0]![0] as { from?: string }).from).toBeUndefined();
  });

  it("refuses before reading when rate limited", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect(readPitchPeriod).not.toHaveBeenCalled();
  });
});
