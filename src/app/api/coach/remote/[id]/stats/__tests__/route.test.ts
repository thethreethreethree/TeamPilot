import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/:id/stats (RSS Phase 2). Pins: a session RLS hides is a 404; door/meetings are not remote;
 * the numbers come from loadSessionTiming (the pipeline's own read) and say when they were estimated; the rep's
 * averages leave this session out and use each session's latest transcript version; no benchmark appears.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/remote/interactionStats", () => ({ loadSessionTiming: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({
  assetUrlToStoragePath: (u: string | null) => (u?.startsWith("assets/") ? u.slice(7) : null),
  signAssetUrl: vi.fn(async () => "https://signed.example/a.mp3"),
}));
const past = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "gte", "order", "limit"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: past.rows, error: null });
      return b;
    },
  }),
}));

import { getSession } from "@/lib/data/salesCoach";
import { loadSessionTiming } from "@/lib/coach/remote/interactionStats";
import { GET } from "../route";

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const call = () => GET(new Request("http://t/x") as never, { params: Promise.resolve({ id: "s1" }) });

beforeEach(() => {
  past.rows = [];
  mock(getSession).mockResolvedValue({ id: "s1", audioAssetUrl: "assets/co1/a.mp3" });
});

describe("GET /api/coach/remote/:id/stats", () => {
  it("404 when RLS hides the session", async () => {
    mock(getSession).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  it("not remote → { remote: false }", async () => {
    mock(loadSessionTiming).mockResolvedValue(null);
    expect(await (await call()).json()).toEqual({ remote: false });
  });

  it("numbers, lanes, the estimated flag, a signed audio URL and the rep's own averages (latest version, this session excluded)", async () => {
    mock(loadSessionTiming).mockResolvedValue({
      sessionId: "s1", companyId: "co1", repId: "rep1", transcriptVersion: 1, estimated: true, untimed: 0,
      segments: [
        { speaker: "rep", startMs: 0, endMs: 3000, text: "How are you?" },
        { speaker: "customer", startMs: 3500, endMs: 6000, text: "Good" },
      ],
    });
    past.rows = [
      { session_id: "s9", transcript_version: 2, talk_ratio_time: 0.5, longest_rep_monologue_ms: 1000, longest_customer_story_ms: 1000, interactivity: 4, patience_ms: 600, rep_questions_per_hour: 20 },
      { session_id: "s9", transcript_version: 1, talk_ratio_time: 0.9, longest_rep_monologue_ms: 9000, longest_customer_story_ms: 0, interactivity: 1, patience_ms: 100, rep_questions_per_hour: 1 },
    ];
    const body = await (await call()).json();
    expect(body).toMatchObject({ remote: true, measurable: true, estimated: true, audioUrl: "https://signed.example/a.mp3" });
    expect(body.lanes.rep).toEqual([[0, 3000]]);
    expect(body.stats.talkRatioTime).toBeCloseTo(3000 / 5500, 5);
    expect(body.averages).toMatchObject({ talkRatioTime: 0.5, sessions: 1 });
    expect(JSON.stringify(body)).not.toMatch(/benchmark/i);
    expect(body.questions).toEqual([{ atMs: 0, text: "How are you?" }]); // F9.6 points of interest
  });
});
