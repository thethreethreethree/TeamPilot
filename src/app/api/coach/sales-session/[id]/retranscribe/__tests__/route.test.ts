import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/retranscribe — recovery for a session whose
 * recording SAVED but whose transcript never landed (STT outage). It downloads the
 * stored audio, re-diarizes, and RETURNS {segments,speakers} for the one-tap labeling
 * flow — it does NOT append the transcript (the existing /label-transcript path does,
 * after the human tap). This locks the seam that matters:
 *   - owner-OR-manager gate (INV19): a colleague can't pull another rep's call content;
 *   - 409 when there's no saved recording; 422 when the pointer isn't the purgeable shape;
 *   - the happy path returns the diarized segments + speaker samples, and stamps ONLY the recording's
 *     audio duration (best-effort, so an upload shows its real length) — never the transcript.
 * downloadAssetBytes + transcribeWithDiarization are mocked; assetUrlToStoragePath is real.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({
  getCurrentCompanyId: vi.fn(async () => "co1"),
}));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/v5/skillAccess", () => ({ isSalesCoachManager: vi.fn(() => false) }));
vi.mock("@/lib/storage/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/assets")>()),
  downloadAssetBytes: vi.fn(),
}));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  transcribeWithDiarization: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { downloadAssetBytes } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const setAuth = (userId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role: "member", sales_coach_role: null } }),
        }),
      }),
    }),
  });
const setSession = (s: unknown) => asMock(getSession).mockResolvedValue(s);
const setManager = (v: boolean) => asMock(isSalesCoachManager).mockReturnValue(v);

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (url = "https://x/api/coach/sales-session/sess1/retranscribe") =>
  ({ url }) as unknown as Parameters<typeof POST>[0];
const VALID_POINTER = "assets-v1/co1/rec.webm";

// Captures the admin update payloads so we can assert the real audio length gets stamped (§3.5).
const durationUpdates: Array<Record<string, unknown>> = [];
// The retranscribe CACHE (finding ④): the row a read returns (null = miss) + the writes an upsert records.
let cacheRow: { result: unknown; audio_asset_url: string } | null = null;
const cacheWrites: Array<Record<string, unknown>> = [];

beforeEach(() => {
  vi.clearAllMocks();
  durationUpdates.length = 0;
  cacheRow = null; // default: cache MISS
  cacheWrites.length = 0;
  setManager(false);
  // The admin client serves two tables: coaching_sessions (duration stamp) and coaching_retranscribe_cache
  // (the diarization cache read + upsert).
  asMock(createAdminClient).mockReturnValue({
    from: (t: string) => {
      if (t === "coaching_retranscribe_cache") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cacheRow }) }) }) }),
          upsert: (payload: Record<string, unknown>) => {
            cacheWrites.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      const chain: Record<string, unknown> = {};
      chain.update = (payload: Record<string, unknown>) => {
        durationUpdates.push(payload);
        return chain;
      };
      chain.eq = () => chain;
      chain.then = (r: (v: unknown) => unknown) => r({ data: null, error: null });
      return chain;
    },
  });
  asMock(downloadAssetBytes).mockResolvedValue({
    ok: true,
    bytes: Buffer.from("audio"),
    contentType: "audio/webm",
  });
  asMock(transcribeWithDiarization).mockResolvedValue({
    segments: [
      { speakerId: "speaker_0", text: "Hi, thanks for the time.", start: 0 },
      { speakerId: "speaker_1", text: "Sure, what's this about?", start: 2 },
    ],
    durationSeconds: 184,
  });
});

describe("POST /retranscribe — recovery, owner-or-manager, read-only", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    setSession(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("403 for a colleague who is neither the owner nor a manager — and never transcribes", async () => {
    setAuth("colleague1");
    setManager(false);
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(transcribeWithDiarization).not.toHaveBeenCalled();
    expect(downloadAssetBytes).not.toHaveBeenCalled();
  });

  it("409 when there is no saved recording to re-transcribe", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: null });
    expect((await POST(req(), ctx)).status).toBe(409);
  });

  it("422 when the saved pointer isn't the recognized bucket-relative shape", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: "https://example.com/leftover.webm" });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(422);
    expect(downloadAssetBytes).not.toHaveBeenCalled();
  });

  it("502 when the stored audio can't be downloaded", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    asMock(downloadAssetBytes).mockResolvedValue({ ok: false, error: "gone" });
    expect((await POST(req(), ctx)).status).toBe(502);
  });

  it("200 for the owning rep — returns diarized segments + speaker samples, appends nothing", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.segments).toHaveLength(2);
    expect(body.segments[0]).toEqual({ speakerId: "speaker_0", text: "Hi, thanks for the time.", seq: 0 });
    expect(body.speakers).toHaveLength(2);
    // downloadAssetBytes got the stripped storage path, not the raw pointer.
    expect(downloadAssetBytes).toHaveBeenCalledWith({ storagePath: "co1/rec.webm" });
    // Recovery re-transcribe also stamps the REAL audio length (§3.5) so a recovered upload shows its
    // length, not the session wall-clock — same contract as the upload route, locked here too.
    expect(durationUpdates).toContainEqual({ audio_duration_seconds: 184 });
    // On a cache MISS it runs STT then CACHES the result keyed on the current audio pointer (finding ④).
    expect(transcribeWithDiarization).toHaveBeenCalledTimes(1);
    expect(cacheWrites).toHaveLength(1);
    expect(cacheWrites[0]).toMatchObject({ session_id: "sess1", audio_asset_url: VALID_POINTER });
  });

  it("CACHE HIT (finding 4): a cached diarization for the CURRENT recording returns without re-running STT", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    cacheRow = {
      audio_asset_url: VALID_POINTER, // matches the session's current recording
      result: { segments: [{ speakerId: "speaker_0", text: "cached", seq: 0 }], speakers: [] },
    };
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).segments[0].text).toBe("cached");
    // No STT re-charge, no download — the whole point of the fix.
    expect(transcribeWithDiarization).not.toHaveBeenCalled();
    expect(downloadAssetBytes).not.toHaveBeenCalled();
  });

  it("STALE cache (a new recording was uploaded) is ignored → re-diarizes", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    cacheRow = {
      audio_asset_url: "assets-v1/co1/OLD.webm", // produced from a DIFFERENT (old) recording
      result: { segments: [{ speakerId: "speaker_0", text: "stale", seq: 0 }], speakers: [] },
    };
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    // The pointer mismatch self-invalidates → fresh STT, and the body is the fresh diarization, not "stale".
    expect(transcribeWithDiarization).toHaveBeenCalledTimes(1);
    expect((await res.json()).segments[0].text).not.toBe("stale");
  });

  it("?force=1 bypasses a valid cache and re-diarizes (deliberate refresh)", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    cacheRow = { audio_asset_url: VALID_POINTER, result: { segments: [{ speakerId: "s", text: "cached", seq: 0 }] } };
    const res = await POST(req("https://x/api/coach/sales-session/sess1/retranscribe?force=1"), ctx);
    expect(res.status).toBe(200);
    expect(transcribeWithDiarization).toHaveBeenCalledTimes(1); // forced: STT ran despite the cache
  });

  it("200 for a MANAGER on another rep's session (owner-OR-manager)", async () => {
    setAuth("manager1");
    setManager(true);
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    expect((await POST(req(), ctx)).status).toBe(200);
  });

  it("502 audioSaved when transcription fails — audio is preserved for retry", async () => {
    setAuth("rep1");
    setSession({ agentId: "rep1", audioAssetUrl: VALID_POINTER });
    asMock(transcribeWithDiarization).mockRejectedValue(new Error("STT 401"));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).audioSaved).toBe(true);
  });
});
