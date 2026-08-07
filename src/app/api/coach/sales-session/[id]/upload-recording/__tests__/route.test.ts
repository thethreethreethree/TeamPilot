import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/upload-recording — the agent uploads a full call
 * recording; we persist it, diarize it, and return speaker samples. Boundaries locked here
 * (DISTINCT from the rest of the surface): 401; 404 for an inaccessible session; the upload
 * VALIDATION gate (missing/empty file → 400, oversize → 413, spoofed executable extension →
 * 400 even with an audio MIME); and the service-role write scoped to the caller's company
 * (defense-in-depth added 2026-07-31, matching the sibling save-recording route). getSession
 * is mocked (its RLS scoping is the real access gate); transcription + storage are mocked.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  transcribeWithDiarization: vi.fn(async () => [
    { speakerId: "speaker_0", text: "Hi there, thanks for the time." },
    { speakerId: "speaker_1", text: "Sure, what are you selling?" },
  ]),
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
  };
});

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getSession } from "@/lib/data/salesCoach";
import { uploadAssetBytes } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { POST } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

const updateEqs: Array<{ col: string; val: unknown }> = [];
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.update = () => chain;
      chain.eq = (col: string, val: unknown) => {
        updateEqs.push({ col, val });
        return chain;
      };
      chain.then = (r: (v: unknown) => unknown) => r({ data: null, error: null });
      return chain;
    },
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
// A request whose formData() yields the given FormData (rateLimit is mocked, so req is otherwise unused).
const reqWith = (fd: FormData | null) =>
  ({ formData: async () => { if (!fd) throw new Error("no form"); return fd; } }) as unknown as Parameters<typeof POST>[0];
const fileForm = (bytes: number, name: string, type: string) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  updateEqs.length = 0;
  mockAdmin();
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess1", context: "in_person" });
});

describe("POST /upload-recording", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(reqWith(fileForm(8, "a.webm", "audio/webm")), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(reqWith(fileForm(8, "a.webm", "audio/webm")), ctx)).status).toBe(404);
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
