import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/label-transcript — the diarized-transcript labeler that makes the B1
 * recording flow work (its output is the canonical transcript every coach engine + the After-Pitch Summary
 * read). Previously untested. The load-bearing behavior: the tapped agent speaker becomes 'agent' and EVERY
 * other speaker becomes 'customer' — a mislabel here silently swaps who's the rep vs the prospect and corrupts
 * all downstream coaching. Also pins the auth gate and 404 for an inaccessible session.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({
  generateSessionArtifacts: vi.fn(async () => ({})),
}));
// Run after()'s callback synchronously so the test can assert the post-response generation fired.
vi.mock("next/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, after: (fn: () => unknown) => void fn() };
});
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
  appendTranscriptSegment: vi.fn(async () => ({})),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { getSession, getSessionTranscript, appendTranscriptSegment } from "@/lib/data/salesCoach";
import { POST } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess1", agentId: "rep1" });
  // Default: no transcript yet, so the append-only double-write guard lets the first label through.
  (getSessionTranscript as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

const BODY = {
  agentSpeakerId: "spk_A",
  segments: [
    { speakerId: "spk_A", text: "Hi, I'm from Acme.", seq: 0 },
    { speakerId: "spk_B", text: "Not interested.", seq: 1 },
    { speakerId: "spk_A", text: "Totally fair — one question?", seq: 2 },
  ],
};

describe("POST /label-transcript", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req(BODY), ctx)).status).toBe(401);
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
  });

  it("404 when the session isn't found/accessible (RLS)", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req(BODY), ctx)).status).toBe(404);
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
  });

  it("403 when the caller is a same-company NON-owner (no cross-user transcript injection)", async () => {
    // getSession is company-scoped (owner OR same-company manager), so a colleague passes the 404 gate.
    // The owner check must then stop them appending fabricated segments into another rep's transcript.
    setAuth("colleague2");
    expect((await POST(req(BODY), ctx)).status).toBe(403);
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
  });

  it("400 on an invalid body (no segments)", async () => {
    setAuth("rep1");
    expect((await POST(req({ agentSpeakerId: "spk_A", segments: [] }), ctx)).status).toBe(400);
  });

  it("409 when the session already has a transcript (append-only double-write guard, A30)", async () => {
    // A second upload — or an upload on top of a live transcript that already saved — must NOT
    // double-append onto the record the after-pitch review runs on. Live coaching writes via
    // /finalize + /segments, not this route, so this guard can't block a live save.
    setAuth("rep1");
    (getSessionTranscript as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { speaker: "agent", text: "existing", seq: 0 },
    ]);
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).alreadyHasTranscript).toBe(true);
    expect(appendTranscriptSegment).not.toHaveBeenCalled();
    // Nothing appended → no post-call generation (can't double-generate on a re-label).
    expect(generateSessionArtifacts).not.toHaveBeenCalled();
  });

  it("labels the tapped speaker 'agent' and every other speaker 'customer'", async () => {
    setAuth("rep1");
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ appended: 3, requested: 3 });
    const calls = (appendTranscriptSegment as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => ({ speaker: c[0].speaker, seq: c[0].seq })
    );
    expect(calls).toEqual([
      { speaker: "agent", seq: 0 }, // spk_A = tapped agent
      { speaker: "customer", seq: 1 }, // spk_B = the other voice
      { speaker: "agent", seq: 2 },
    ]);
  });

  it("generates the post-call artifacts from the labeled transcript (uploaded-recording parity with /finalize)", async () => {
    // The regression this guards: an uploaded-recording session had a transcript but NO summary/dissect,
    // because /finalize (which generates them for LIVE sessions) is never called on the upload path. This
    // route must now trigger the SAME shared generation after appending — else the founder-reported "new
    // sessions have no summary page" (2026-08-12) returns.
    setAuth("rep1");
    // The full transcript is read back AFTER append and passed to generation.
    (getSessionTranscript as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // the pre-append 409 guard check
      .mockResolvedValueOnce([
        { speaker: "agent", text: "Hi, I'm from Acme.", seq: 0 },
        { speaker: "customer", text: "Not interested.", seq: 1 },
      ]);
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(200);
    expect(getCurrentCompanyId).toHaveBeenCalled();
    expect(generateSessionArtifacts).toHaveBeenCalledTimes(1);
    const [arg] =
      (generateSessionArtifacts as unknown as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(arg).toMatchObject({ companyId: "co1", actorId: "rep1", sessionId: "sess1" });
    expect((arg as { segments: unknown[] }).segments).toHaveLength(2);
  });

  it("skips generation when there is no company context (never runs ungated)", async () => {
    setAuth("rep1");
    (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req(BODY), ctx);
    expect(res.status).toBe(200); // the transcript still saves
    expect(generateSessionArtifacts).not.toHaveBeenCalled();
  });
});
