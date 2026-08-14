import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/realtime-token — mints the ElevenLabs Scribe realtime token for live coaching.
 * The concurrency-hardening behaviour pinned here: a token-mint failure is CLASSIFIED by HTTP status so a rep in
 * a busy hour reads an honest cause — a 429 (too many sessions starting at once) is a TRANSIENT "try again"
 * (503, retryable), a 402/403 is an account limit (502, not retryable), anything else is the generic couldn't-
 * start (502). Every failure still points at the Upload-recording fallback.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/care/voice/elevenlabs", () => ({ mintRealtimeSttToken: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { mintRealtimeSttToken } from "@/lib/care/voice/elevenlabs";
import { POST } from "../route";

const mk = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const setAuth = (userId: string | null) =>
  mk(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });
const withStatus = (status: number) => {
  const e = new Error(`ElevenLabs token mint failed: ${status}`) as Error & { status?: number };
  e.status = status;
  return e;
};
const req = () => ({}) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  setAuth("rep1");
});

describe("POST /realtime-token", () => {
  it("401 unauthenticated (no token minted)", async () => {
    setAuth(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(mintRealtimeSttToken).not.toHaveBeenCalled();
  });

  it("200 + token on success", async () => {
    mk(mintRealtimeSttToken).mockResolvedValue("tok_abc");
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).token).toBe("tok_abc");
  });

  it("429 (concurrent load) → 503 retryable, honest 'busy' message", async () => {
    mk(mintRealtimeSttToken).mockRejectedValue(withStatus(429));
    const res = await POST(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.retryable).toBe(true);
    expect(body.error.toLowerCase()).toContain("busy");
  });

  it("402/403 (account limit) → 502 not retryable", async () => {
    for (const s of [402, 403]) {
      mk(mintRealtimeSttToken).mockRejectedValue(withStatus(s));
      const res = await POST(req());
      expect(res.status).toBe(502);
      expect((await res.json()).retryable).toBe(false);
    }
  });

  it("an unclassified failure → 502 generic couldn't-start (points at upload)", async () => {
    mk(mintRealtimeSttToken).mockRejectedValue(new Error("some network blip"));
    const res = await POST(req());
    expect(res.status).toBe(502);
    expect((await res.json()).error.toLowerCase()).toContain("upload");
  });
});
