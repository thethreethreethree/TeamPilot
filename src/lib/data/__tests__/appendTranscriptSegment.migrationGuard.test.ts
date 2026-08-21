import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * appendTranscriptSegment's migration-coupling fallback (A34, [[feedback_migration_coupling_no_assert]]). The
 * predicate isMissingColumnError is tested in migrationGuard.test.ts; THIS locks the CONSUMER (decision tested,
 * execution untested): if the `source` column (0236) isn't applied in an env, the insert must retry WITHOUT
 * `source` rather than LOSE the segment — the transcript matters far more than the diagnostic. A regression
 * that dropped the retry would silently lose every segment on a deploy-before-migrate.
 */
const state = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  results: [] as Array<{ data: unknown; error: unknown }>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserts.push(row);
        const res = state.results.shift() ?? { data: null, error: null };
        return { select: () => ({ single: async () => res }) };
      },
    }),
  }),
}));
vi.mock("@/lib/coach/v5/migrationGuard", () => ({ isMissingColumnError: vi.fn() }));

import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";
import { appendTranscriptSegment } from "../salesCoach";

const ROW = { id: "seg1", session_id: "s1", speaker: "agent", text: "hi", seq: 0, spoken_at: null };
const ARGS = { sessionId: "s1", speaker: "agent" as const, text: "hi", seq: 0, source: "manual" };

beforeEach(() => {
  vi.clearAllMocks();
  state.inserts = [];
  state.results = [];
});

describe("appendTranscriptSegment — migration-coupling fallback for the 0236 `source` column", () => {
  it("retries WITHOUT source when the column is missing, keeping the segment", async () => {
    state.results = [
      { data: null, error: { message: "column source does not exist", code: "42703" } },
      { data: ROW, error: null },
    ];
    (isMissingColumnError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const r = await appendTranscriptSegment(ARGS);
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]).toMatchObject({ source: "manual" }); // first attempt WITH source
    expect(state.inserts[1]).not.toHaveProperty("source"); // retry WITHOUT source
    expect(r).not.toBeNull();
    expect(r?.sessionId).toBe("s1");
  });

  it("does NOT retry when the first insert succeeds (source column present — the prod path)", async () => {
    state.results = [{ data: ROW, error: null }];
    const r = await appendTranscriptSegment(ARGS);
    expect(state.inserts).toHaveLength(1);
    expect(r).not.toBeNull();
    expect(isMissingColumnError).not.toHaveBeenCalled();
  });

  it("treats a 23505 duplicate as an idempotent no-op (returns null, no retry)", async () => {
    state.results = [{ data: null, error: { code: "23505", message: "duplicate key" } }];
    (isMissingColumnError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const r = await appendTranscriptSegment(ARGS);
    expect(r).toBeNull();
    expect(state.inserts).toHaveLength(1); // a dup is NOT a missing-column → no retry
  });
});
