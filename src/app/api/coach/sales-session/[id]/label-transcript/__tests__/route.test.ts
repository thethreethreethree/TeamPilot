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
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  appendTranscriptSegment: vi.fn(async () => ({})),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";
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

  it("400 on an invalid body (no segments)", async () => {
    setAuth("rep1");
    expect((await POST(req({ agentSpeakerId: "spk_A", segments: [] }), ctx)).status).toBe(400);
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
});
