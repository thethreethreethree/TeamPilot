import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/calls and /:id/finalize (Engage plan E6, 0387; review 2026-11-27). Pinned: the "upload" scope; the rep is an
 * active person of the KEY's company; a daily cap per key counted before transcription; the app upload's file rules; JSON
 * returns a signed upload for a file named after the call, and finalize accepts only that file, only for a call made
 * through the API, once; multipart works for small files; nothing is scored here (the rep's voice pick scores it).
 */
const REP = "11111111-1111-4111-8111-111111111111";
const CALL = "22222222-2222-4222-8222-222222222222";
const st = vi.hoisted(() => ({
  auth: null as unknown,
  rep: null as unknown,
  uploadsToday: 0,
  apiMade: 1,
  prior: null as unknown,
  call: null as unknown,
  info: { sizeBytes: 10, contentType: "audio/mpeg" } as unknown,
  eqs: [] as Array<[string, string, unknown]>,
  inserts: [] as Array<{ table: string; row: unknown }>,
  updates: [] as Array<{ table: string; patch: unknown }>,
  transcribe: { ok: true, segments: [{ speakerId: "speaker_0", text: "hi" }], durationSeconds: 60 } as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/publicApi", () => ({ authenticateApiKey: vi.fn(async () => st.auth), recordApiUsage: vi.fn(async () => undefined) }));
vi.mock("../publicApi", () => ({ authenticateApiKey: vi.fn(async () => st.auth), recordApiUsage: vi.fn(async () => undefined) }));
vi.mock("@/lib/data/salesCoach", () => ({
  createSession: vi.fn(async (a: Record<string, unknown>) => ({ id: CALL, startedAt: "2026-11-27T10:00:00Z", ...a })),
  setSessionStatus: vi.fn(async () => ({})),
}));
vi.mock("@/lib/storage/assets", () => ({
  buildStoragePath: (a: { companyId: string; fileId: string }) => `${a.companyId}/2026/11/${a.fileId}.mp3`,
  createSignedUploadTarget: vi.fn(async (a: { companyId: string; fileId: string }) => ({ ok: true, storagePath: `${a.companyId}/2026/11/${a.fileId}.mp3`, token: "tok" })),
  getAssetObjectInfo: vi.fn(async () => st.info),
  downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: Buffer.from("abc"), contentType: "audio/mpeg" })),
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
      q.gte = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
      q.limit = () => q;
      q.maybeSingle = async () => ({ data: table === "profiles" ? st.rep : table === "coaching_sessions" ? st.call : table === "audit_log" ? st.prior : null, error: null });
      q.update = (patch: unknown) => (st.updates.push({ table, patch }), q);
      // counts: audit_log is read for the daily cap (by key) and for "made through the API" (by object id)
      q.then = (r: (v: unknown) => unknown) => r({ error: null, count: table === "audit_log" ? (st.eqs.some(([t, c]) => t === "audit_log" && c === "object_id") ? st.apiMade : st.uploadsToday) : 0 });
      q.insert = async (row: unknown) => (st.inserts.push({ table, row }), { error: null });
      return q;
    },
  }),
}));
import { POST as CREATE } from "@/app/api/v1/calls/route";
import { POST as FINALIZE } from "@/app/api/v1/calls/[id]/finalize/route";
import { createSession } from "@/lib/data/salesCoach";
import { transcribeUploadedAudio } from "@/lib/coach/v5/transcribeUpload";

const json = (b: unknown, idem?: string) => new Request("http://x/api/v1/calls", { method: "POST", headers: { "content-type": "application/json", ...(idem ? { "idempotency-key": idem } : {}) }, body: JSON.stringify(b) });
function multipart(fields: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return new Request("http://x/api/v1/calls", { method: "POST", body: f });
}
const fin = (path: string, id = CALL) => FINALIZE(new Request(`http://x/api/v1/calls/${id}/finalize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) }), { params: Promise.resolve({ id }) });
const META = { repId: REP, channel: "phone", filename: "call.mp3", sizeBytes: 10, mimeType: "audio/mpeg" };
beforeEach(() => {
  st.auth = { keyId: "k1", companyId: "co1", createdBy: "admin-1", scopes: ["read", "upload"] };
  st.rep = { id: REP, status: "active" };
  st.uploadsToday = 0;
  st.apiMade = 1;
  st.prior = null;
  st.call = { id: CALL, agent_id: REP, context: "phone", started_at: "2026-11-27T10:00:00Z", client_label: null, audio_asset_url: null };
  st.info = { sizeBytes: 10, contentType: "audio/mpeg" };
  st.eqs = [];
  st.inserts = [];
  st.updates = [];
  vi.clearAllMocks();
});

describe("POST /api/v1/calls", () => {
  it("a key without the upload scope is refused before anything happens", async () => {
    st.auth = NextResponse.json({ error: "no" }, { status: 403 });
    expect((await CREATE(json(META))).status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("the rep must be an active person of the key's company", async () => {
    st.rep = null;
    expect((await CREATE(json(META))).status).toBe(404);
    expect(st.eqs).toContainEqual(["profiles", "company_id", "co1"]);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("the daily upload cap per key is checked before a call is made", async () => {
    st.uploadsToday = 200;
    expect((await CREATE(json(META))).status).toBe(429);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("the app upload's file rules on the claimed file", async () => {
    expect((await CREATE(json({ ...META, channel: "door" }))).status).toBe(400);
    expect((await CREATE(json({ ...META, sizeBytes: 5000 }))).status).toBe(413);
    expect((await CREATE(json({ ...META, mimeType: "text/plain" }))).status).toBe(400);
    expect((await CREATE(json({ ...META, filename: "x.exe" }))).status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("JSON: the call is made for the rep and a signed upload returned, named after the call; nothing transcribed yet", async () => {
    const r = await CREATE(json({ ...META, title: "Acme" }));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.upload.path).toBe(`co1/2026/11/${CALL}.mp3`);
    expect(j.upload.url).toContain(`/storage/v1/object/upload/sign/assets-v1/co1/2026/11/${CALL}.mp3?token=tok`);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", agentId: REP, context: "phone", clientLabel: "Acme" }));
    expect(transcribeUploadedAudio).not.toHaveBeenCalled();
  });
  it("multipart for a small file: stored, attached, transcribed, the rep told", async () => {
    const r = await CREATE(multipart({ file: new File([new Uint8Array(10)], "c.mp3", { type: "audio/mpeg" }), repId: REP, channel: "video" }));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ id: CALL, status: "waiting_for_rep" });
    expect(st.updates).toContainEqual({ table: "coaching_sessions", patch: { audio_asset_url: `assets-v1/co1/2026/11/${CALL}.mp3` } });
    expect(st.inserts).toContainEqual({ table: "manager_notifications", row: expect.objectContaining({ recipient_id: REP, type: "call_needs_voice" }) });
  });
});

describe("Idempotency-Key (review 2026-11-27)", () => {
  it("a retry with the same key gets the first call back; nothing new is made", async () => {
    st.prior = { object_id: CALL };
    const r = await CREATE(json(META, "retry-abc-123"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: CALL, replayed: true });
    expect(createSession).not.toHaveBeenCalled();
    expect(st.eqs).toContainEqual(["audit_log", "meta->>idem", "retry-abc-123"]);
  });
  it("a first use makes the call and records the key with it", async () => {
    const { recordAudit } = await import("@/lib/audit/recordAudit");
    expect((await CREATE(json(META, "first-use-0001"))).status).toBe(201);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ meta: expect.objectContaining({ idem: "first-use-0001" }) }));
  });
});

describe("POST /api/v1/calls/:id/finalize", () => {
  it("only this call's own file, in this company's space", async () => {
    expect((await fin(`co2/2026/11/${CALL}.mp3`)).status).toBe(403);
    expect((await fin(`co1/2026/11/33333333-3333-4333-8333-333333333333.mp3`)).status).toBe(403);
    expect((await fin(`co1/2026/11/${CALL}.mp3/../x`)).status).toBe(403);
  });
  it("only a call made through the API, and only once", async () => {
    st.apiMade = 0;
    expect((await fin(`co1/2026/11/${CALL}.mp3`)).status).toBe(403);
    st.apiMade = 1;
    st.call = { ...(st.call as object), audio_asset_url: "assets-v1/x" };
    expect((await fin(`co1/2026/11/${CALL}.mp3`)).status).toBe(409);
  });
  it("checks the STORED file (size, type), then attaches and transcribes it", async () => {
    st.info = { sizeBytes: 5000, contentType: "audio/mpeg" };
    expect((await fin(`co1/2026/11/${CALL}.mp3`)).status).toBe(413);
    st.info = { sizeBytes: 10, contentType: "audio/mpeg" };
    const r = await fin(`co1/2026/11/${CALL}.mp3`);
    expect(r.status).toBe(201);
    expect(transcribeUploadedAudio).toHaveBeenCalledWith(expect.objectContaining({ companyId: "co1", sessionId: CALL }));
    expect(st.eqs).toContainEqual(["coaching_sessions", "company_id", "co1"]);
  });
});
