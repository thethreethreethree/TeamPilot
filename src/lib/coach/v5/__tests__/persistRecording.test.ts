import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * persistRecording — the client "never lose the audio" save (founder priority 2026-08-12). It must, in order:
 * mint a signed target, PUT the bytes direct to Storage, then finalize with persistOnly (stamp
 * audio_asset_url, skip STT). And it must THROW at every failure so the caller (LiveCoachingPanel) can fall
 * back rather than silently believing the audio is safe. The route side is covered by the upload-recording
 * test; this locks the CLIENT orchestration + its throw-on-failure contract (mocking would-be network calls).
 */
const uploadToSignedUrl = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl }) } }),
}));

import { persistRecording } from "../persistRecording";

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });

/** Queue of responses for successive fetch() calls (sign, then finalize). */
function mockFetch(seq: Array<{ ok: boolean; body?: unknown }>) {
  let i = 0;
  global.fetch = vi.fn(async () => {
    const r = seq[i++] ?? { ok: false, body: {} };
    return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.body } as unknown as Response;
  }) as unknown as typeof fetch;
}
const fetchMock = () => global.fetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  uploadToSignedUrl.mockResolvedValue({ error: null });
});

describe("persistRecording", () => {
  it("sign → uploadToSignedUrl → finalize(persistOnly), in order", async () => {
    mockFetch([
      { ok: true, body: { bucket: "assets", storagePath: "co1/x/live.webm", token: "tok" } },
      { ok: true, body: { ok: true, persisted: true } },
    ]);
    await persistRecording("sess1", blob);

    const calls = fetchMock().mock.calls;
    expect(calls).toHaveLength(2);
    // 1. signed the upload for this session
    expect(calls[0]?.[0]).toContain("/api/coach/sales-session/sess1/upload-recording/sign");
    // 2. PUT the bytes direct to storage with the minted path + token
    expect(uploadToSignedUrl).toHaveBeenCalledWith("co1/x/live.webm", "tok", blob);
    // 3. finalized with persistOnly (save the audio, skip transcription)
    expect(calls[1]?.[0]).toContain("/api/coach/sales-session/sess1/upload-recording");
    const finBody = JSON.parse((calls[1]?.[1]?.body as string) ?? "{}");
    expect(finBody).toEqual({ storagePath: "co1/x/live.webm", persistOnly: true });
  });

  it("throws if the sign step fails — never uploads", async () => {
    mockFetch([{ ok: false, body: { error: "sign failed" } }]);
    await expect(persistRecording("s", blob)).rejects.toThrow();
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });

  it("throws if the direct-to-storage upload errors — never finalizes", async () => {
    mockFetch([{ ok: true, body: { bucket: "assets", storagePath: "co1/x/a.webm", token: "t" } }]);
    uploadToSignedUrl.mockResolvedValueOnce({ error: { message: "storage boom" } });
    await expect(persistRecording("s", blob)).rejects.toThrow();
    // only the sign fetch ran; finalize never did
    expect(fetchMock().mock.calls).toHaveLength(1);
  });

  it("throws if finalize fails (audio uploaded but the pointer wasn't stamped) — caller must not assume safe", async () => {
    mockFetch([
      { ok: true, body: { bucket: "assets", storagePath: "co1/x/a.webm", token: "t" } },
      { ok: false, body: { error: "stamp failed" } },
    ]);
    await expect(persistRecording("s", blob)).rejects.toThrow();
  });
});
