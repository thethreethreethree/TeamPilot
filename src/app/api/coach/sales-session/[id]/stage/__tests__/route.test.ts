import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/:id/stage (RSS Phase 1, F6.6). Pins: door sessions and meetings are not remote;
 * the stage is derived from what exists; a recorded failure comes back with its words; a missing failures table
 * (0275 not applied) is "no failure", not an error; and a session RLS hides is a 404.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));

const t = vi.hoisted(() => ({
  segCount: 0,
  analysis: [] as unknown[],
  score: [] as unknown[],
  failures: { data: [] as unknown[], error: null as { code: string; message: string } | null },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) =>
        res(
          table === "coaching_transcript_segments_current"
            ? { count: t.segCount, error: null }
            : table === "after_pitch_summaries"
              ? { data: t.analysis, error: null }
              : table === "pitch_scores"
                ? { data: t.score, error: null }
                : t.failures
        );
      return b;
    },
  }),
}));

import { getSession } from "@/lib/data/salesCoach";
import { GET } from "../route";

const call = () => GET(new Request("http://t/x") as never, { params: Promise.resolve({ id: "s1" }) });
const session = (over: Record<string, unknown> = {}) =>
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "s1", context: "phone", sessionKind: "sales", status: "ended", audioAssetUrl: "x", ...over,
  });

beforeEach(() => {
  t.segCount = 0;
  t.analysis = [];
  t.score = [];
  t.failures = { data: [], error: null };
});

describe("GET stage", () => {
  it("a door session or a video meeting is not remote", async () => {
    session({ context: "in_person" });
    expect(await (await call()).json()).toEqual({ remote: false });
    session({ context: "video", sessionKind: "meeting" });
    expect(await (await call()).json()).toEqual({ remote: false });
  });

  it("derives the stage from what exists", async () => {
    session();
    expect((await (await call()).json()).state).toBe("transcribing");
    t.segCount = 12;
    expect((await (await call()).json()).state).toBe("analyzing");
    t.analysis = [{}];
    t.score = [{}];
    expect((await (await call()).json()).state).toBe("scored");
  });

  it("a recorded failure comes back with its words", async () => {
    session();
    t.failures = { data: [{ reason_code: "NO_SPEECH" }], error: null };
    expect(await (await call()).json()).toMatchObject({ state: "failed", failure: { code: "NO_SPEECH", label: "No speech heard" } });
  });

  it("before 0275 (no failures table) it is simply 'no failure'", async () => {
    session();
    t.failures = { data: null as never, error: { code: "PGRST205", message: "missing" } };
    expect((await call()).status).toBe(200);
  });

  it("a session RLS hides is a 404", async () => {
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
});
