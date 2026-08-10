import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Locks the authz gate on the voice-health probe. It reveals ElevenLabs ACCOUNT-level quota, so it
 * must be manager-gated — a rep (or an unauthenticated caller) must never see it. Detection test:
 * 401 unauth, 403 non-manager, 200 + probe result for a manager.
 */

const authCtx = { current: null as { userId: string } | null };
const profile = {
  current: { role: "member", sales_coach_role: null, company_id: "co1" } as Record<string, unknown> | null,
};
const managerFlag = { current: false };
const probeResult = {
  current: { ok: true, summary: "healthy", checks: [{ name: "quota", ok: true, detail: "fine" }] },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile.current }) }) }),
    }),
  })),
}));
vi.mock("@/lib/supabase/auth-helpers", () => ({
  getCurrentAuthContext: vi.fn(async () => authCtx.current),
}));
vi.mock("@/lib/coach/v5/skillAccess", () => ({
  isSalesCoachManager: vi.fn(() => managerFlag.current),
}));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  probeElevenLabsVoice: vi.fn(async () => probeResult.current),
}));

import { GET } from "../route";
import { probeElevenLabsVoice } from "@/lib/care/voice/elevenlabs";

beforeEach(() => {
  authCtx.current = { userId: "u1" };
  managerFlag.current = false;
  probeResult.current = { ok: true, summary: "healthy", checks: [{ name: "quota", ok: true, detail: "fine" }] };
  vi.clearAllMocks();
});

describe("voice-health route — authz gate", () => {
  it("401 when not authenticated (never probes)", async () => {
    authCtx.current = null;
    const res = await GET();
    expect(res.status).toBe(401);
    expect(probeElevenLabsVoice).not.toHaveBeenCalled();
  });

  it("403 for a non-manager — account quota must not leak to a rep", async () => {
    managerFlag.current = false;
    const res = await GET();
    expect(res.status).toBe(403);
    expect(probeElevenLabsVoice).not.toHaveBeenCalled(); // gate BEFORE the provider call
  });

  it("200 + probe verdict for a manager", async () => {
    managerFlag.current = true;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBe("healthy");
    expect(probeElevenLabsVoice).toHaveBeenCalledOnce();
  });
});
