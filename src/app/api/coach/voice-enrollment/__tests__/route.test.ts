import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Voice-enrollment route — the mandatory voice gate's store/read (9/2 meeting). The load-bearing rules:
 *  - the caller writes their OWN profile (caller-scoped client, RLS), never someone else's;
 *  - an out-of-range F0 or too-thin capture is rejected (422) — never store a garbage reference;
 *  - a pending migration (voice_enrolled_at absent) degrades to an honest "not yet", not a 500.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { GET, POST } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const req = () => ({}) as unknown as Parameters<typeof POST>[0];

// A chainable profiles client capturing the update payload; getUser returns `userId`.
function client(userId: string | null, opts: { selectData?: unknown; selectError?: unknown; updateError?: unknown } = {}) {
  const captured: { update?: Record<string, unknown>; updatedId?: unknown } = {};
  return {
    captured,
    sb: {
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.selectData ?? null, error: opts.selectError ?? null }) }) }),
        update: (u: Record<string, unknown>) => { captured.update = u; return { eq: (_c: string, v: unknown) => { captured.updatedId = v; return Promise.resolve({ error: opts.updateError ?? null }); } }; },
      }),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/coach/voice-enrollment", () => {
  it("401 when unauthenticated", async () => {
    asMock(readBody).mockResolvedValue({ f0Hz: 120, voicedFrames: 60 });
    asMock(createClient).mockResolvedValue(client(null).sb);
    expect((await POST(req())).status).toBe(401);
  });

  it("422 for an out-of-range F0 (never store a garbage reference)", async () => {
    asMock(readBody).mockResolvedValue({ f0Hz: 900, voicedFrames: 60 });
    asMock(createClient).mockResolvedValue(client("me").sb);
    expect((await POST(req())).status).toBe(422);
  });

  it("422 for too few voiced frames", async () => {
    asMock(readBody).mockResolvedValue({ f0Hz: 120, voicedFrames: 3 });
    asMock(createClient).mockResolvedValue(client("me").sb);
    expect((await POST(req())).status).toBe(422);
  });

  it("stores voice_f0_hz + voice_enrolled_at on the CALLER's own row", async () => {
    asMock(readBody).mockResolvedValue({ f0Hz: 128.5, voicedFrames: 80 });
    const c = client("me");
    asMock(createClient).mockResolvedValue(c.sb);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(c.captured.updatedId).toBe("me");
    expect(c.captured.update).toMatchObject({ voice_f0_hz: 128.5 });
    expect(typeof c.captured.update!.voice_enrolled_at).toBe("string");
  });

  it("503 (honest 'not yet'), not 500, when the migration is pending", async () => {
    asMock(readBody).mockResolvedValue({ f0Hz: 120, voicedFrames: 60 });
    asMock(createClient).mockResolvedValue(
      client("me", { updateError: { code: "PGRST204", message: "Could not find the 'voice_enrolled_at' column in the schema cache" } }).sb
    );
    expect((await POST(req())).status).toBe(503);
  });
});

describe("GET /api/coach/voice-enrollment", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(client(null).sb);
    expect((await GET(req())).status).toBe(401);
  });

  it("reports enrolled + f0Hz from the caller's profile", async () => {
    asMock(createClient).mockResolvedValue(client("me", { selectData: { voice_f0_hz: 130, voice_enrolled_at: "2026-09-09T00:00:00Z" } }).sb);
    const body = await (await GET(req())).json();
    expect(body).toEqual({ enrolled: true, f0Hz: 130 });
  });

  it("degrades to not-enrolled when the migration is pending (no 500)", async () => {
    asMock(createClient).mockResolvedValue(
      client("me", { selectError: { code: "42703", message: 'column profiles.voice_enrolled_at does not exist' } }).sb
    );
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ enrolled: false, f0Hz: null });
  });
});
