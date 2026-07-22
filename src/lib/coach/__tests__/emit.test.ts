import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CoachCitation } from "../heuristics";

/**
 * Coach chain-event emission (§3.1). The load-bearing property (header comment + the 2026-06-12 L2 audit): it
 * must NEVER throw — the Coach cannot block a user's draft from being sent, even if the events table rejects the
 * insert or the client throws. Also: it stays silent (no insert) when there's no session/tenant, and on success
 * writes the right event kind + a bounded payload. Untested until now.
 */

const state = vi.hoisted(() => ({
  enabled: true,
  user: { id: "u1" } as { id: string } | null,
  profile: { company_id: "c1" } as { company_id: string } | null,
  insertResult: { error: null } as { error: unknown },
  throwOnInsert: false,
  insertSpy: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile }) }) }) };
      }
      return {
        insert: (row: unknown) => {
          state.insertSpy(row);
          if (state.throwOnInsert) throw new Error("client boom");
          return Promise.resolve(state.insertResult);
        },
      };
    },
  }),
}));

import { emitCoachOffered, emitCoachAccepted, emitCoachDismissed } from "../emit";

const citation = {
  id: "judgment_language",
  label: "I noticed some judgment language",
  source: "NVC",
  triggerExcerpt: "you always",
} as unknown as CoachCitation;

const opts = { subject: "chat_topic:abc", citation, draftExcerpt: "you always miss deadlines", mirrorCount: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = true;
  state.user = { id: "u1" };
  state.profile = { company_id: "c1" };
  state.insertResult = { error: null };
  state.throwOnInsert = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("coach event emission — never blocks the draft", () => {
  it("does NOT throw when the insert returns an error (RLS/FK/NOT NULL)", async () => {
    state.insertResult = { error: { code: "42501", message: "rls denied" } };
    await expect(emitCoachOffered(opts)).resolves.toBeUndefined();
    expect(state.insertSpy).toHaveBeenCalledTimes(1); // it did attempt
  });

  it("does NOT throw when the client itself throws (network etc.)", async () => {
    state.throwOnInsert = true;
    await expect(emitCoachAccepted(opts)).resolves.toBeUndefined();
  });
});

describe("coach event emission — silent when there's no session/tenant", () => {
  it("no-ops when Supabase is disabled (never even builds the client)", async () => {
    state.enabled = false;
    await emitCoachOffered(opts);
    expect(state.insertSpy).not.toHaveBeenCalled();
  });

  it("no-ops when signed out", async () => {
    state.user = null;
    await emitCoachOffered(opts);
    expect(state.insertSpy).not.toHaveBeenCalled();
  });

  it("no-ops when the profile has no company_id", async () => {
    state.profile = null;
    await emitCoachOffered(opts);
    expect(state.insertSpy).not.toHaveBeenCalled();
  });
});

describe("coach event emission — payload", () => {
  it("writes the right kind, subject, and a bounded mirror-mode payload", async () => {
    await emitCoachOffered(opts);
    const row = state.insertSpy.mock.calls[0]?.[0] as {
      kind: string;
      subject: string;
      company_id: string;
      payload: { mode: string; mirror_count: number; heuristic_id: string; draft_excerpt: string };
    };
    expect(row.kind).toBe("coach.suggestion_offered");
    expect(row.subject).toBe("chat_topic:abc");
    expect(row.company_id).toBe("c1");
    expect(row.payload.mode).toBe("mirror");
    expect(row.payload.mirror_count).toBe(3);
    expect(row.payload.heuristic_id).toBe("judgment_language");
  });

  it("caps the draft excerpt at 280 chars", async () => {
    await emitCoachOffered({ ...opts, draftExcerpt: "x".repeat(500) });
    const row = state.insertSpy.mock.calls[0]?.[0] as { payload: { draft_excerpt: string } };
    expect(row.payload.draft_excerpt.length).toBe(280);
  });

  it("the three exports emit three distinct kinds", async () => {
    await emitCoachOffered(opts);
    await emitCoachAccepted(opts);
    await emitCoachDismissed(opts);
    const kinds = state.insertSpy.mock.calls.map((c) => (c[0] as { kind: string }).kind);
    expect(kinds).toEqual([
      "coach.suggestion_offered",
      "coach.suggestion_accepted",
      "coach.suggestion_dismissed",
    ]);
  });
});
