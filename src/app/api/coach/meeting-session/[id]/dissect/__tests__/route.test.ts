import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/coach/meeting-session/[id]/dissect — the post-meeting review. Boundaries: 401/404/403(non-owner)/
 * 400(sales session); the stored dissect event is the CACHE (returns it without re-transcribing); 409 when
 * there's no audio; happy path transcribes → generate-and-store → returns.
 */
const state = vi.hoisted(() => ({ cachedPayload: null as unknown, storagePath: "co/s1/recording.webm" as string | null }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: state.cachedPayload ? { payload: state.cachedPayload } : null }) }) }) }) }) }) }),
    }),
  }),
}));
vi.mock("@/lib/storage/assets", () => ({
  assetUrlToStoragePath: () => state.storagePath,
  downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: new Uint8Array([1, 2, 3]), contentType: "audio/webm" })),
}));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  transcribeWithDiarization: vi.fn(async () => ({ segments: [{ speakerId: "speaker_0", text: "hi", start: 0 }], durationSeconds: 60 })),
}));
vi.mock("@/lib/coach/strategy/meeting/generateMeetingDissect", () => ({
  generateAndStoreMeetingDissect: vi.fn(async () => ({ hasSignal: true, decisions: [{ decision: "Ship", context: "" }], actions: [], openItems: [], effectiveness: null })),
}));

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/salesCoach";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { generateAndStoreMeetingDissect } from "@/lib/coach/strategy/meeting/generateMeetingDissect";
import { POST } from "../route";

const OWNER = "facil-1";
const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
function setAuth(userId: string | null) {
  asMock(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } });
}
const req = () => ({ url: "https://x/api/coach/meeting-session/s1/dissect" }) as unknown as NextRequest;
const ctx = { params: Promise.resolve({ id: "s1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  state.cachedPayload = null;
  state.storagePath = "co/s1/recording.webm";
  setAuth(OWNER);
  asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, companyId: "co1", sessionKind: "meeting", audioAssetUrl: "assets-v1/co/s1/recording.webm", clientLabel: "Sync" });
});

describe("POST meeting-session dissect", () => {
  it("401 unauthenticated", async () => { setAuth(null); expect((await POST(req(), ctx)).status).toBe(401); });

  it("404 when the session isn't found", async () => {
    asMock(getSession).mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("403 for a non-owner", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: "someone", companyId: "co1", sessionKind: "meeting" });
    expect((await POST(req(), ctx)).status).toBe(403);
  });

  it("400 for a sales session", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, companyId: "co1", sessionKind: "sales" });
    expect((await POST(req(), ctx)).status).toBe(400);
  });

  it("returns the cached dissect event WITHOUT re-transcribing", async () => {
    state.cachedPayload = { decisions: [{ decision: "cached" }], coach_version: "meeting-dissect-v1" };
    const res = await POST(req(), ctx);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(transcribeWithDiarization).not.toHaveBeenCalled();
    expect(generateAndStoreMeetingDissect).not.toHaveBeenCalled();
  });

  it("409 when there's no saved audio", async () => {
    asMock(getSession).mockResolvedValue({ id: "s1", agentId: OWNER, companyId: "co1", sessionKind: "huddle", audioAssetUrl: null });
    state.storagePath = null;
    expect((await POST(req(), ctx)).status).toBe(409);
  });

  it("happy path: transcribes (N-party auto), generate-and-stores, returns", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(json.dissect.hasSignal).toBe(true);
    expect(transcribeWithDiarization).toHaveBeenCalledTimes(1);
    // N-party: numSpeakers NOT pinned to 2 (auto-detect)
    expect(asMock(transcribeWithDiarization).mock.calls[0]?.[0].numSpeakers).toBeUndefined();
    expect(asMock(generateAndStoreMeetingDissect).mock.calls[0]?.[0].segments[0].speaker).toBe("speaker_0");
  });
});
