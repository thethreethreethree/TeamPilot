import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/attribute-unlabelled — the rep answers "whose voice
 * is this?" for a transcript that is already saved but unattributed.
 *
 * Load-bearing properties pinned here:
 *  - OWNER-ONLY (writes the canonical transcript via the service role — A18).
 *  - NEVER rewrites attributed speech: one agent or customer turn and it refuses (409).
 *  - The update is scoped to `speaker = unknown`, so a slower concurrent answer changes
 *    nothing rather than overwriting the first.
 *  - `spoken_at` is never in the payload, so answering CANNOT lose the timing — the whole
 *    reason this route exists instead of an echo through /label-transcript.
 *  - No default for `mine`: guessing which way a rep meant to answer is the fabricated
 *    attribution the entire path exists to avoid.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({
  generateSessionArtifacts: vi.fn(async () => ({})),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, after: (fn: () => unknown) => void fn() };
});
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { POST } from "../route";

const mk = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const setAuth = (userId: string | null) =>
  mk(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

/** Captures the update payload and the filters it was scoped by. */
let updatePayload: Record<string, unknown> | null;
let eqFilters: Array<[string, unknown]>;
let updateResult: { data: unknown[] | null; error: unknown };
function setupAdmin() {
  updatePayload = null;
  eqFilters = [];
  updateResult = { data: [{ id: "s1" }, { id: "s2" }], error: null };
  const seg: Record<string, unknown> = {};
  seg.update = (p: Record<string, unknown>) => {
    updatePayload = p;
    return seg;
  };
  seg.eq = (col: string, val: unknown) => {
    eqFilters.push([col, val]);
    return seg;
  };
  seg.select = () => Promise.resolve(updateResult);
  mk(createAdminClient).mockReturnValue({ from: () => seg });
}

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

const unknownTranscript = [
  { speaker: "unknown", text: "Morning, I am from Elostate.", seq: 0 },
  { speaker: "unknown", text: "How much is it?", seq: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  setupAdmin();
  setAuth("rep1");
  mk(getSession).mockResolvedValue({ id: "sess1", agentId: "rep1", startedAt: "2026-09-10T07:52:00Z" });
  mk(getSessionTranscript).mockResolvedValue(unknownTranscript);
});

describe("POST attribute-unlabelled", () => {
  it("labels the whole transcript AGENT when the rep says the voice is theirs", async () => {
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "attributed", speaker: "agent", labeled: 2 });
    expect(updatePayload).toEqual({ speaker: "agent", source: "manual" });
  });

  it("labels it CUSTOMER when only the prospect was recorded — a real answer, not a failure", async () => {
    const res = await POST(req({ mine: false }), ctx);
    expect((await res.json()).speaker).toBe("customer");
    // No coaching artifacts: there are still no agent turns, so generating would spend an
    // LLM call to produce the same empty read.
    expect(generateSessionArtifacts).not.toHaveBeenCalled();
  });

  it("scopes the update to speaker=unknown, so a slower concurrent answer changes nothing", async () => {
    await POST(req({ mine: true }), ctx);
    expect(eqFilters).toContainEqual(["session_id", "sess1"]);
    expect(eqFilters).toContainEqual(["speaker", "unknown"]);
  });

  it("NEVER sends spoken_at — answering cannot lose the timing", async () => {
    // The whole reason this route exists rather than echoing segments through
    // /label-transcript, which rebuilds spoken_at from the payload and nulls it when the
    // payload omits it.
    await POST(req({ mine: true }), ctx);
    expect(updatePayload).not.toHaveProperty("spokenAt");
    expect(updatePayload).not.toHaveProperty("spoken_at");
  });

  it("409s a transcript that already says who spoke — attributed speech is canonical", async () => {
    mk(getSessionTranscript).mockResolvedValue([
      { speaker: "agent", text: "Morning.", seq: 0 },
      { speaker: "unknown", text: "Mm.", seq: 1 },
    ]);
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).status).toBe("already-attributed");
    expect(updatePayload).toBeNull();
  });

  it("409s a call with no transcript at all — there is nothing to attribute yet", async () => {
    mk(getSessionTranscript).mockResolvedValue([]);
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).status).toBe("no-transcript");
  });

  it("REFUSES to guess when the answer is missing or not a boolean", async () => {
    for (const body of [{}, { mine: "yes" }, { mine: 1 }, { mine: null }]) {
      const res = await POST(req(body), ctx);
      expect(res.status).toBe(400);
    }
    expect(updatePayload).toBeNull();
  });

  it("403s a colleague — only the session's own rep may answer for it", async () => {
    mk(getSession).mockResolvedValue({ id: "sess1", agentId: "someone-else" });
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(403);
    expect(updatePayload).toBeNull();
  });

  it("401s when nobody is signed in", async () => {
    setAuth(null);
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(401);
    expect(updatePayload).toBeNull();
  });

  it("regenerates the coaching artifacts once there are agent turns to read", async () => {
    await POST(req({ mine: true }), ctx);
    expect(generateSessionArtifacts).toHaveBeenCalledTimes(1);
  });

  it("does not claim success when the write failed", async () => {
    updateResult = { data: null, error: { message: "boom" } };
    const res = await POST(req({ mine: true }), ctx);
    expect(res.status).toBe(500);
    expect(generateSessionArtifacts).not.toHaveBeenCalled();
  });
});
