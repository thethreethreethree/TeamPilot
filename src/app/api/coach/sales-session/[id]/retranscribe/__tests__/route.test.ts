import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/retranscribe — recovery for a session whose
 * recording SAVED but whose transcript never landed (STT outage). It downloads the
 * stored audio, re-diarizes, and RETURNS {segments,speakers} for the one-tap labeling
 * flow — it does NOT append the transcript (the existing /label-transcript path does,
 * after the human tap). This locks the seam that matters:
 *   - owner-OR-manager gate (INV19): a colleague can't pull another rep's call content;
 *   - 409 when there's no saved recording; 422 when the pointer isn't the purgeable shape;
 *   - the happy path returns the diarized segments + speaker samples, and NEVER writes.
 * downloadAssetBytes + transcribeWithDiarization are mocked; assetUrlToStoragePath is real.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
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
const req = () => ({}) as unknown as Parameters<typeof POST>[0];
const VALID_POINTER = "assets-v1/co1/rec.webm";

beforeEach(() => {
  vi.clearAllMocks();
  setManager(false);
  asMock(downloadAssetBytes).mockResolvedValue({
    ok: true,
    bytes: Buffer.from("audio"),
    contentType: "audio/webm",
  });
  asMock(transcribeWithDiarization).mockResolvedValue([
    { speakerId: "speaker_0", text: "Hi, thanks for the time." },
    { speakerId: "speaker_1", text: "Sure, what's this about?" },
  ]);
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
