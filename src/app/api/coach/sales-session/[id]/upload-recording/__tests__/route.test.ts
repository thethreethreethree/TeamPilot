import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/upload-recording — the agent attaches a full call
 * recording; we persist it, diarize it, and return speaker samples. TWO entry points:
 *   • multipart (legacy / small-file fallback) — file in the request body.
 *   • JSON { storagePath } (the DIRECT-to-storage finalize) — the browser already PUT the bytes
 *     straight to Storage via a signed target (bypassing the ~4.5 MB serverless body cap), and
 *     we transcribe FROM storage. This is the path a real phone recording / voice memo takes.
 *
 * Boundaries locked here (DISTINCT from the rest of the surface): 401; 404 for an inaccessible
 * session; 403 for a colleague who is neither the owner nor a Sales-Coach manager (INV19, applied
 * to BOTH entry points); the multipart VALIDATION gate (missing/empty → 400, oversize → 413,
 * spoofed executable extension → 400); the JSON finalize gate (missing storagePath → 400, object
 * not found → 404, oversize → 413, non-media stored type → 400); the service-role write scoped to
 * the caller's company; and the recovery contract (audio persisted BEFORE transcription, audioSaved
 * flagged on failure). getSession is mocked (its RLS scoping is the real access gate); transcription
 * + storage are mocked.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/v5/skillAccess", () => ({ isSalesCoachManager: vi.fn(() => false) }));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  transcribeWithDiarization: vi.fn(async () => ({
    segments: [
      { speakerId: "speaker_0", text: "Hi there, thanks for the time.", start: 0 },
      { speakerId: "speaker_1", text: "Sure, what are you selling?", start: 3 },
    ],
    durationSeconds: 247,
  })),
}));
// Keep EXECUTABLE_EXTENSIONS real (the .exe list under test) but stub the storage side and
// shrink the size cap so an oversize case doesn't need a giant buffer.
vi.mock("@/lib/storage/assets", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/storage/assets")>();
  return {
    ...orig,
    AGENT_MAX_BYTES: 32,
    ASSETS_BUCKET: "assets",
    buildStoragePath: () => "co1/abc/recording.webm",
    uploadAssetBytes: vi.fn(async () => ({ ok: true })),
    getAssetObjectInfo: vi.fn(async () => ({ sizeBytes: 10, contentType: "audio/m4a" })),
    downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: new Uint8Array([1, 2, 3]), contentType: "audio/m4a" })),
  };
});

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { uploadAssetBytes, getAssetObjectInfo, downloadAssetBytes } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { POST } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    // The INV19 owner gate reads the caller's profile role via the server client.
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { role: "agent", sales_coach_role: null } }) }),
      }),
    }),
  });

const updateEqs: Array<{ col: string; val: unknown }> = [];
const updatePayloads: Array<Record<string, unknown>> = [];
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.update = (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        updateEqs.push({ col, val });
        return chain;
      };
      chain.then = (r: (v: unknown) => unknown) => r({ data: null, error: null });
      return chain;
    },
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
// A multipart request whose formData() yields the given FormData. content-type is non-JSON so the
// route takes the multipart branch (rateLimit is mocked, so req is otherwise unused).
const reqWith = (fd: FormData | null) =>
  ({
    headers: { get: () => "multipart/form-data" },
    formData: async () => { if (!fd) throw new Error("no form"); return fd; },
  }) as unknown as Parameters<typeof POST>[0];
// A direct-to-storage FINALIZE request: JSON content-type + a { storagePath } body.
const jsonReq = (body: unknown) =>
  ({
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => body,
  }) as unknown as Parameters<typeof POST>[0];
const fileForm = (bytes: number, name: string, type: string) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  updateEqs.length = 0;
  updatePayloads.length = 0;
  mockAdmin();
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  // Owner-path default: the caller (rep1) owns the session, so the INV19 gate passes.
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess1", context: "in_person", agentId: "rep1" });
  (isSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
  (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ sizeBytes: 10, contentType: "audio/m4a" });
  (downloadAssetBytes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2, 3]), contentType: "audio/m4a" });
});

describe("POST /upload-recording (multipart)", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(reqWith(fileForm(8, "a.webm", "audio/webm")), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(reqWith(fileForm(8, "a.webm", "audio/webm")), ctx)).status).toBe(404);
  });

  it("403 for a colleague who is neither the owner nor a manager (INV19)", async () => {
    setAuth("rep2"); // session.agentId is rep1; isSalesCoachManager returns false
    expect((await POST(reqWith(fileForm(8, "a.webm", "audio/webm")), ctx)).status).toBe(403);
  });

  it("400 when no file is present", async () => {
    setAuth("rep1");
    expect((await POST(reqWith(new FormData()), ctx)).status).toBe(400);
  });

  it("413 when the recording exceeds the size cap", async () => {
    setAuth("rep1");
    expect((await POST(reqWith(fileForm(64, "a.webm", "audio/webm")), ctx)).status).toBe(413);
  });

  it("400 rejects a spoofed executable even with an audio MIME", async () => {
    setAuth("rep1");
    // small + audio/webm MIME passes size + prefix, but the .exe extension is refused.
    expect((await POST(reqWith(fileForm(8, "malware.exe", "audio/webm")), ctx)).status).toBe(400);
  });

  it("200 on a valid recording, with the service-role write scoped to the company", async () => {
    setAuth("rep1");
    const res = await POST(reqWith(fileForm(8, "call.webm", "audio/webm")), ctx);
    expect(res.status).toBe(200);
    expect(updateEqs).toContainEqual({ col: "id", val: "sess1" });
    expect(updateEqs).toContainEqual({ col: "company_id", val: "co1" }); // defense-in-depth
    // The real audio length (from transcription) is stamped so an upload shows its length, not wall-clock.
    expect(updatePayloads).toContainEqual({ audio_duration_seconds: 247 });
  });

  // The RECOVERY CONTRACT. This path fired 4× in the 2026-08 ElevenLabs outage (orphaned
  // recordings — audio saved, no transcript). Recovery is only possible because the audio is
  // PERSISTED and its url STAMPED *before* transcription is attempted, and the response tells
  // the client the audio survived (audioSaved:true). Locking it so a future refactor can't
  // reorder persist-after-transcribe (would drop the audio on failure) or silently drop the flag.
  it("502 + audioSaved:true when transcription fails — audio persisted FIRST (recovery contract)", async () => {
    setAuth("rep1");
    (transcribeWithDiarization as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ElevenLabs STT 402 (quota)")
    );
    const res = await POST(reqWith(fileForm(8, "call.webm", "audio/webm")), ctx);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.audioSaved).toBe(true);
    // Proof the audio survived the transcription failure: it was stored AND the url stamped
    // (the company-scoped update ran) BEFORE the throw — this is what makes the 4 orphans recoverable.
    expect(uploadAssetBytes).toHaveBeenCalled();
    expect(updateEqs).toContainEqual({ col: "id", val: "sess1" });
    expect(updateEqs).toContainEqual({ col: "company_id", val: "co1" });
  });
});

describe("POST /upload-recording (direct-to-storage finalize, JSON)", () => {
  it("400 when storagePath is missing", async () => {
    setAuth("rep1");
    expect((await POST(jsonReq({}), ctx)).status).toBe(400);
  });

  it("403 when storagePath is outside the caller's company — no admin read of a foreign object (audit 2026-08-11)", async () => {
    setAuth("rep1"); // company is co1
    // buildStoragePath mints "<companyId>/...", so a path under a DIFFERENT company must be refused BEFORE
    // any admin getAssetObjectInfo/downloadAssetBytes runs — closes the cross-company object-read vector.
    const res = await POST(jsonReq({ storagePath: "co2/2026/08/someone-elses.m4a" }), ctx);
    expect(res.status).toBe(403);
    expect(getAssetObjectInfo).not.toHaveBeenCalled();
  });

  it("404 when the uploaded object isn't in storage", async () => {
    setAuth("rep1");
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await POST(jsonReq({ storagePath: "co1/x/rec.m4a" }), ctx)).status).toBe(404);
  });

  it("413 when the REAL stored size exceeds the cap (untrusted client size)", async () => {
    setAuth("rep1");
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ sizeBytes: 64, contentType: "audio/m4a" });
    expect((await POST(jsonReq({ storagePath: "co1/x/rec.m4a" }), ctx)).status).toBe(413);
  });

  it("400 when the stored object is a clearly non-media type", async () => {
    setAuth("rep1");
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ sizeBytes: 10, contentType: "application/pdf" });
    expect((await POST(jsonReq({ storagePath: "co1/x/doc.pdf" }), ctx)).status).toBe(400);
  });

  it("200 finalizes a voice memo: stamps the pointer (company-scoped) + returns diarized speakers", async () => {
    setAuth("rep1");
    const res = await POST(jsonReq({ storagePath: "co1/x/memo.m4a" }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.speakers).toHaveLength(2);
    expect(body.segments).toHaveLength(2);
    expect(updateEqs).toContainEqual({ col: "id", val: "sess1" });
    expect(updateEqs).toContainEqual({ col: "company_id", val: "co1" });
    // The real audio length is stamped (§3.5) — a memo shows its length, not the session open-time.
    expect(updatePayloads).toContainEqual({ audio_duration_seconds: 247 });
  });

  it("200 tolerates an empty stored content-type (memo picked from Files)", async () => {
    setAuth("rep1");
    (getAssetObjectInfo as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ sizeBytes: 10, contentType: null });
    expect((await POST(jsonReq({ storagePath: "co1/x/memo" }), ctx)).status).toBe(200);
  });

  it("502 + audioSaved:true when transcription fails — pointer stamped FIRST (recovery contract)", async () => {
    setAuth("rep1");
    (transcribeWithDiarization as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ElevenLabs STT 402 (quota)")
    );
    const res = await POST(jsonReq({ storagePath: "co1/x/memo.m4a" }), ctx);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.audioSaved).toBe(true);
    // The pointer was stamped before the transcription throw → the audio is recoverable.
    expect(updateEqs).toContainEqual({ col: "id", val: "sess1" });
    expect(updateEqs).toContainEqual({ col: "company_id", val: "co1" });
  });

  // persistOnly — the LIVE-coaching "never lose the audio" save (founder priority 2026-08-12). On Stop the
  // live path calls this JUST to persist the recorded audio (stamp audio_asset_url), skipping transcription,
  // so a call whose live STT captured nothing is always recoverable. Locking BOTH halves: it stamps the
  // pointer (company-scoped) AND does NOT spend the STT/LLM (the whole point — cheap, always-runs-on-Stop save).
  it("persistOnly: stamps the pointer (company-scoped) + returns persisted, WITHOUT transcribing", async () => {
    setAuth("rep1");
    const res = await POST(jsonReq({ storagePath: "co1/x/live.webm", persistOnly: true }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(true);
    expect(body.audioSaved).toBe(true);
    // Audio pointer stamped (company-scoped) — the recording is now safe in storage.
    expect(updateEqs).toContainEqual({ col: "id", val: "sess1" });
    expect(updateEqs).toContainEqual({ col: "company_id", val: "co1" });
    expect(updatePayloads).toContainEqual({ audio_asset_url: "assets/co1/x/live.webm" });
    // But transcription was SKIPPED — persistOnly saves the audio, it does not spend STT.
    expect(transcribeWithDiarization).not.toHaveBeenCalled();
  });
});
