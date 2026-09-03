import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateAndStoreAfterPitch (A16 drift-guard): the ONE sequence both the After-Pitch route and the recovery
 * backfill run. The properties that matter: a signal-bearing summary is persisted (rep-owned) AND emits the
 * coarse event; a thin/one-sided summary (hasSignal:false) stores NOTHING and emits NOTHING (3.4 — no
 * fabrication); and the event emit is best-effort (a failing insert never sinks the save).
 */
const state = vi.hoisted(() => ({
  summary: { hasSignal: true, moments: [{ isBreakdown: true }], cueLoop: [1], focus: "x" } as {
    hasSignal: boolean;
    moments: Array<{ isBreakdown: boolean }>;
    cueLoop: number[];
    focus: string | null;
  },
  saved: [] as unknown[],
  events: [] as unknown[],
  eventThrows: false,
}));

vi.mock("@/lib/coach/v5/afterPitch", () => ({
  generateAfterPitchSummary: async () => state.summary,
}));
vi.mock("@/lib/data/salesCoach", () => ({
  saveAfterPitchSummary: async (a: unknown) => {
    state.saved.push(a);
    return true;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: unknown) => {
        if (state.eventThrows) throw new Error("event insert down");
        state.events.push(row);
        return { error: null };
      },
    }),
  }),
}));
// Gamification wire (Phase 3): bank points from the just-saved scores. Mock it so we can assert it fires.
vi.mock("@/lib/coach/gamification/bankPoints", () => ({
  bankSessionPoints: vi.fn(async () => ({ banked: true, points: 60, band: "solid", strong: false })),
}));
// Phase 4: a strong session fans out a manager notification.
vi.mock("@/lib/coach/gamification/notify", () => ({ notifyStrongSession: vi.fn(async () => {}) }));

import { bankSessionPoints } from "@/lib/coach/gamification/bankPoints";
import { notifyStrongSession } from "@/lib/coach/gamification/notify";
const { generateAndStoreAfterPitch } = await import("../generateAndStoreAfterPitch");

const args = { companyId: "c1", sessionId: "s1", agentId: "a1", actorId: "viewer1" };

beforeEach(() => {
  state.summary = { hasSignal: true, moments: [{ isBreakdown: true }], cueLoop: [1], focus: "x" };
  state.saved = [];
  state.events = [];
  state.eventThrows = false;
  vi.mocked(bankSessionPoints).mockClear();
  vi.mocked(bankSessionPoints).mockResolvedValue({ banked: true, points: 60, band: "solid", strong: false });
  vi.mocked(notifyStrongSession).mockClear();
});

describe("generateAndStoreAfterPitch", () => {
  it("persists the rep-owned summary and emits the coarse event when there is signal", async () => {
    const r = await generateAndStoreAfterPitch(args);
    expect(r.generated).toBe(true);
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({ sessionId: "s1", companyId: "c1", agentId: "a1" });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ kind: "coach.after_pitch_summary_generated", subject: "sales_session:s1" });
  });

  it("banks gamification points (Phase 3 wire) after saving a signal-bearing summary", async () => {
    await generateAndStoreAfterPitch(args);
    expect(bankSessionPoints).toHaveBeenCalledWith("s1");
  });

  it("fans out a strong-session notification only when the banked session is strong (Phase 4 wire)", async () => {
    // sub-threshold → no alert
    await generateAndStoreAfterPitch(args);
    expect(notifyStrongSession).not.toHaveBeenCalled();
    // strong → alert fires with the session + points
    vi.mocked(bankSessionPoints).mockResolvedValueOnce({ banked: true, points: 88, band: "strong", strong: true });
    await generateAndStoreAfterPitch(args);
    expect(notifyStrongSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "s1", points: 88, band: "strong" }));
  });

  it("stores NOTHING and emits NOTHING when the transcript is thin (hasSignal:false — no fabrication)", async () => {
    state.summary = { hasSignal: false, moments: [], cueLoop: [], focus: null };
    const r = await generateAndStoreAfterPitch(args);
    expect(r.generated).toBe(false);
    expect(state.saved).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    // No summary → no points banked (nothing to bank).
    expect(bankSessionPoints).not.toHaveBeenCalled();
  });

  it("a bankSessionPoints failure never sinks the after-pitch save (best-effort wire)", async () => {
    vi.mocked(bankSessionPoints).mockRejectedValueOnce(new Error("ledger down"));
    const r = await generateAndStoreAfterPitch(args);
    expect(r.generated).toBe(true);
    expect(state.saved).toHaveLength(1); // the summary persisted despite the points failing
  });

  it("still returns generated:true when the coarse event emit fails (best-effort — the save already landed)", async () => {
    state.eventThrows = true;
    const r = await generateAndStoreAfterPitch(args);
    expect(r.generated).toBe(true);
    expect(state.saved).toHaveLength(1); // the summary persisted despite the event failing
  });
});
