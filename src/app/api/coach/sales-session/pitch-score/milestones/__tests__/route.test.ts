import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/pitch-score/milestones.
 *
 * Three things distinguish this route from the breakdown route beside it, and each is a way to be
 * confidently wrong rather than to fail:
 *
 *   1. NO PERIOD. Every milestone is a "first" or an "Nth", so a window answers a different
 *      question. "Your first pitch was Monday" is true of this week and false about the rep.
 *   2. OLDEST FIRST. The read caps at 900; newest-first would date "First pitch" to the
 *      900th-most-recent pitch for a busy rep.
 *   3. The caller's OWN strip by default. A manager's request with no repId would otherwise derive
 *      one person's milestones from the whole company's pitches.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ tag: "cookie" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/coach/pitchScore/readPitchPeriod", () => ({ readPitchPeriod: vi.fn() }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchPeriod } from "@/lib/coach/pitchScore/readPitchPeriod";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const ME = "rep-me";

const req = (qs = "") =>
  ({
    nextUrl: { searchParams: new URLSearchParams(qs) },
    url: `https://x.test/api/coach/sales-session/pitch-score/milestones?${qs}`,
    headers: new Headers(),
  }) as never;

const SECTIONS_ZERO = {
  introduction: 0, discovery: 0, consulting: 0, close: 0, transitions: 0, delivery: 0,
};

const pitch = (recordedAt: string, total = 60) => ({
  repId: ME,
  recordedAt,
  score: {
    base: 45, bonus: 0, violations: 0, total,
    qualifying: true, notQualifyingReason: null,
    sectionPoints: SECTIONS_ZERO, bonusBreakdown: [], violationBreakdown: [],
  },
  elements: [],
});

const args = () => asMock(readPitchPeriod).mock.calls[0]![0] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(rateLimit).mockReturnValue(null);
  asMock(resolveApiAuth).mockResolvedValue({ userId: ME, companyId: "co1" });
  asMock(readPitchPeriod).mockResolvedValue({
    pitches: [pitch("2026-08-12T10:00:00.000Z"), pitch("2026-09-18T10:00:00.000Z", 104)],
    skippedPreVerdict: 0,
  });
});

describe("the read is all-time and oldest-first", () => {
  it("passes no period window at all", async () => {
    await GET(req());
    // A window would answer a different question and answer it confidently.
    expect(args().from).toBeUndefined();
    expect(args().to).toBeUndefined();
  });

  it("asks for the oldest pitches first", async () => {
    await GET(req());
    // Newest-first plus the 900 cap dates "First pitch" to the 900th-most-recent pitch.
    expect(args().oldestFirst).toBe(true);
  });

  it("reports when the read hit its bound", async () => {
    asMock(readPitchPeriod).mockResolvedValue({
      pitches: Array.from({ length: 900 }, (_, i) =>
        pitch(new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString())
      ),
      skippedPreVerdict: 0,
    });
    const body = await (await GET(req())).json();
    expect(body.capped).toBe(true);
  });

  it("does not claim capped when it is not", async () => {
    const body = await (await GET(req())).json();
    expect(body.capped).toBe(false);
  });
});

describe("whose milestones these are", () => {
  it("defaults to the caller", async () => {
    await GET(req());
    expect(args().repId).toBe(ME);
  });

  it("honours an explicit repId, leaving RLS to decide whether it is allowed", async () => {
    // 0252 grants select to the rep themself or a Sales Coach manager. A rep asking for someone
    // else gets no rows rather than an error, which is the policy doing its job.
    await GET(req("repId=someone-else"));
    expect(args().repId).toBe("someone-else");
  });

  it("never reads unscoped by rep", async () => {
    // Without a repId the derivation would take the earliest pitch in the company and present it
    // as this person's first.
    await GET(req());
    expect(args().repId).toBeTruthy();
  });
});

describe("the milestones themselves come back derived", () => {
  it("dates the first counted pitch and the triple-digit one", async () => {
    const body = await (await GET(req())).json();
    expect(body.milestones.firstPitch).toBe("2026-08-12T10:00:00.000Z");
    expect(body.milestones.tripleDigits).toBe("2026-09-18T10:00:00.000Z");
  });

  it("returns every key, unearned ones as null", async () => {
    const body = await (await GET(req())).json();
    // Present-and-null, so the strip renders six badges rather than a ragged row.
    expect(body.milestones.century).toBeNull();
    expect(Object.keys(body.milestones)).toHaveLength(6);
  });
});

describe("a failed read is not an empty strip", () => {
  it("returns 500 rather than six unearned badges", async () => {
    asMock(readPitchPeriod).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(500);
    // Six grey badges is a statement about the rep. A failed read must not make it.
    expect(await res.json()).not.toHaveProperty("milestones");
  });

  it("refuses an anonymous caller before reading", async () => {
    asMock(resolveApiAuth).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(readPitchPeriod).not.toHaveBeenCalled();
  });

  it("refuses before reading when rate limited", async () => {
    asMock(rateLimit).mockReturnValue(new Response(null, { status: 429 }));
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect(readPitchPeriod).not.toHaveBeenCalled();
  });
});
