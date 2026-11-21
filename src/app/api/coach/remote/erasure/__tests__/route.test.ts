import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/v5/removeRecordingAudio", () => ({ removeRecordingAudio: vi.fn() }));
const db = vi.hoisted(() => ({
  log: [] as string[],
  matches: [] as unknown[],
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  audio: [] as unknown[],
  eraseError: null as unknown,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {},
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.log.push(`rpc:${fn}`);
      if (fn === "rss_erasure_matches") return { data: db.matches, error: null, args };
      return { data: db.eraseError ? null : { sessions: (args.p_sessions as unknown[]).length }, error: db.eraseError };
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "not"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: table === "coaching_sessions" ? db.audio : [], error: null });
      b.insert = (row: Record<string, unknown>) => {
        db.log.push(`insert:${table}`);
        db.inserts.push({ table, row });
        return { select: () => ({ maybeSingle: async () => ({ data: { id: "req-1" }, error: null }) }) };
      };
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";
import { POST } from "../route";

const ADMIN = { userId: "ceo", companyId: "co1", role: "CEO", isAdmin: true };
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;
const M = (id: string) => ({ session_id: id, started_at: "2026-11-19T10:00:00Z", agent_id: "rep1", client_label: "Pat", context: "phone", snippet: "reach me at 555" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  db.log = [];
  db.inserts = [];
  db.matches = [M("s1"), M("s2")];
  db.audio = [];
  db.eraseError = null;
  vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
  vi.mocked(removeRecordingAudio).mockResolvedValue({ ok: true, chunksRemoved: 0 });
});

describe("POST /api/coach/remote/erasure", () => {
  it("a manager who is not a company admin is refused before any search", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ ...ADMIN, isAdmin: false } as never);
    expect((await POST(post({ action: "find", kind: "phone", value: "5550100123" }))).status).toBe(403);
    expect(db.log).toEqual([]);
  });
  it("find: returns the matches with the line, and the hint, never the identifier", async () => {
    const body = await (await POST(post({ action: "find", kind: "phone", value: "+1 555 010 0123" }))).json();
    expect(body.hint).toBe("phone ••••0123");
    expect(body.matches.map((m: { sessionId: string }) => m.sessionId)).toEqual(["s1", "s2"]);
    expect(db.inserts).toEqual([]);
  });
  it("erase refuses a call the search did not return, and writes nothing", async () => {
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1", "not-a-match"] }));
    expect(res.status).toBe(400);
    expect(db.inserts).toEqual([]);
    expect(db.log).not.toContain("rpc:rss_erase_sessions");
  });
  it("a recording that can't be removed stops everything before the database is touched", async () => {
    db.audio = [{ id: "s1", company_id: "co1", audio_asset_url: "weird://x" }];
    vi.mocked(removeRecordingAudio).mockResolvedValue({ ok: false, reason: "malformed-pointer" });
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1"] }));
    expect(res.status).toBe(409);
    expect(db.log).not.toContain("rpc:rss_erase_sessions");
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it("erase, in order: search again, record the request (hash + hint only), remove audio, erase, audit", async () => {
    db.audio = [{ id: "s1", company_id: "co1", audio_asset_url: "assets-v1/co1/s1/recording.webm" }];
    const res = await POST(post({ action: "erase", kind: "phone", value: "+1 (555) 010-0123", sessionIds: ["s1"] }));
    expect(res.status).toBe(200);
    expect(db.log).toEqual(["rpc:rss_erasure_matches", "insert:erasure_requests", "rpc:rss_erase_sessions"]);
    const reqRow = db.inserts[0]!.row;
    expect(reqRow).toMatchObject({ company_id: "co1", requested_by: "ceo", match_kind: "phone", match_hint: "phone ••••0123" });
    expect(String(reqRow.match_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(reqRow)).not.toContain("5550100123"); // the identifier itself is never stored
    expect(removeRecordingAudio).toHaveBeenCalledOnce();
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "erasure.request", objectId: "req-1" }));
    expect(await res.json()).toMatchObject({ erased: 1, audioRemoved: 1 });
  });
  it("no hashing key on the server: refused before anything is recorded or removed", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1"] }));
    expect(res.status).toBe(503);
    expect(db.inserts).toEqual([]);
    expect(removeRecordingAudio).not.toHaveBeenCalled();
  });
});
