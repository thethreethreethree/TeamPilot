import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/calls (Engage plan E6, 0387). Pinned: the key needs the "upload" scope; the rep must be an active person of
 * the KEY's company; the app upload's file rules; on success the call is made for that rep, its audio stored and pointed
 * to (company-pinned), it is ended, transcribed by the shared upload transcription, the rep is told (call_needs_voice) and
 * the upload is audited — and it is NOT scored here (the rep's voice pick scores it).
 */
const st = vi.hoisted(() => ({
  auth: { keyId: "k1", companyId: "co1", createdBy: "admin-1", scopes: ["read", "upload"] } as unknown,
  rep: { id: "11111111-1111-4111-8111-111111111111", status: "active" } as unknown,
  eqs: [] as Array<[string, string, unknown]>,
  inserts: [] as Array<{ table: string; row: unknown }>,
  updates: [] as Array<{ table: string; patch: unknown }>,
  transcribe: { ok: true, segments: [{ speakerId: "speaker_0", text: "hi" }], durationSeconds: 60 } as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/publicApi", () => ({ authenticateApiKey: vi.fn(async () => st.auth), recordApiUsage: vi.fn(async () => undefined) }));
vi.mock("../publicApi", () => ({ authenticateApiKey: vi.fn(async () => st.auth), recordApiUsage: vi.fn(async () => undefined) }));
vi.mock("@/lib/data/salesCoach", () => ({
  createSession: vi.fn(async (a: Record<string, unknown>) => ({ id: "sess-1", startedAt: "2026-11-27T10:00:00Z", ...a })),
  setSessionStatus: vi.fn(async () => ({})),
}));
vi.mock("@/lib/storage/assets", () => ({
  buildStoragePath: () => "co1/file-1/recording.mp3",
  uploadAssetBytes: vi.fn(async () => ({ ok: true })),
  recordingMaxBytes: () => 1000,
  ASSETS_BUCKET: "assets-v1",
  EXECUTABLE_EXTENSIONS: [".exe"],
}));
vi.mock("@/lib/coach/v5/transcribeUpload", () => ({ transcribeUploadedAudio: vi.fn(async () => st.transcribe) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
      q.maybeSingle = async () => ({ data: table === "profiles" ? st.rep : null, error: null });
      q.update = (patch: unknown) => (st.updates.push({ table, patch }), q);
      q.then = (r: (v: unknown) => unknown) => r({ error: null });
      q.insert = async (row: unknown) => (st.inserts.push({ table, row }), { error: null });
      return q;
    },
  }),
}));
import { POST } from "@/app/api/v1/calls/route";
const uploadCall = (r: Request) => POST(r);
import { createSession, setSessionStatus } from "@/lib/data/salesCoach";
import { transcribeUploadedAudio } from "@/lib/coach/v5/transcribeUpload";

const REP = "11111111-1111-4111-8111-111111111111";
function req(fields: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return new Request("http://x/api/v1/calls", { method: "POST", body: f });
}
const audio = (bytes = 10, type = "audio/mpeg", name = "call.mp3") => new File([new Uint8Array(bytes)], name, { type });
beforeEach(() => {
  st.auth = { keyId: "k1", companyId: "co1", createdBy: "admin-1", scopes: ["read", "upload"] };
  st.rep = { id: REP, status: "active" };
  st.eqs = [];
  st.inserts = [];
  st.updates = [];
  vi.clearAllMocks();
});

describe("POST /api/v1/calls", () => {
  it("a key without the upload scope is refused before anything happens", async () => {
    st.auth = NextResponse.json({ error: "no" }, { status: 403 });
    expect((await uploadCall(req({ file: audio(), repId: REP, channel: "phone" }))).status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("the rep must be an active person of the key's company", async () => {
    st.rep = null;
    expect((await uploadCall(req({ file: audio(), repId: REP, channel: "phone" }))).status).toBe(404);
    expect(st.eqs).toContainEqual(["profiles", "company_id", "co1"]);
    st.rep = { id: REP, status: "removed" };
    expect((await uploadCall(req({ file: audio(), repId: REP, channel: "phone" }))).status).toBe(404);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("the app upload's file rules: channel, size, type, no executable", async () => {
    expect((await uploadCall(req({ file: audio(), repId: REP, channel: "door" }))).status).toBe(400);
    expect((await uploadCall(req({ file: audio(5000), repId: REP, channel: "phone" }))).status).toBe(413);
    expect((await uploadCall(req({ file: audio(10, "text/plain", "x.txt"), repId: REP, channel: "phone" }))).status).toBe(400);
    expect((await uploadCall(req({ file: audio(10, "audio/mpeg", "x.exe"), repId: REP, channel: "phone" }))).status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("makes the call for the rep, stores and transcribes it, ends it, tells the rep — and doesn't score it", async () => {
    const r = await uploadCall(req({ file: audio(), repId: REP, channel: "video", title: "Acme demo" }));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ id: "sess-1", status: "waiting_for_rep" });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", agentId: REP, context: "video", clientLabel: "Acme demo" }));
    expect(st.updates).toContainEqual({ table: "coaching_sessions", patch: { audio_asset_url: "assets-v1/co1/file-1/recording.mp3" } });
    expect(st.eqs).toContainEqual(["coaching_sessions", "company_id", "co1"]);
    expect(setSessionStatus).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "sess-1", status: "ended" }));
    expect(transcribeUploadedAudio).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", sessionId: "sess-1", context: "video" }));
    expect(st.inserts).toContainEqual({ table: "manager_notifications", row: expect.objectContaining({ recipient_id: REP, type: "call_needs_voice", session_id: "sess-1" }) });
  });
  it("a failed transcription still answers with the call (the audio is kept)", async () => {
    st.transcribe = { ok: false, code: "AI_UNAVAILABLE" };
    const j = await (await uploadCall(req({ file: audio(), repId: REP, channel: "phone" }))).json();
    expect(j).toMatchObject({ id: "sess-1", status: "transcription_failed" });
    st.transcribe = { ok: true, segments: [{ speakerId: "speaker_0", text: "hi" }], durationSeconds: 60 };
  });
});
