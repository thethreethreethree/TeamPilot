import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({ generateSessionArtifacts: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(), getSessionTranscript: vi.fn() }));
const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  rpc: [] as string[],
  insertError: null as unknown,
  trim: null as unknown,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string) => (db.rpc.push(fn), { data: 3, error: null }),
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "in"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: table === "recording_trims" ? (db.trim ?? { id: "t-new" }) : null, error: null });
      b.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
      b.insert = (row: unknown) => {
        db.inserts.push({ table, row });
        const r: Record<string, unknown> = { select: () => r, maybeSingle: async () => ({ data: { id: "t-new" }, error: db.insertError }) };
        r.then = (res: (v: unknown) => unknown) => res({ error: db.insertError });
        return r;
      };
      return b;
    },
  }),
}));

import { after } from "next/server";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { POST } from "../route";

const MGR = { userId: "m1", companyId: "co1" };
const SESSION = { id: "s1", companyId: "co1", agentId: "rep1", audioDurationSeconds: 600, startedAt: "2026-11-20T10:00:00Z", endedAt: null };
const post = (body: unknown) => [new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) }] as const;
const timed = [{ spokenAt: "2026-11-20T10:00:05Z" }, { spokenAt: "2026-11-20T10:01:00Z" }];

beforeEach(() => {
  vi.clearAllMocks();
  db.inserts = [];
  db.rpc = [];
  db.insertError = null;
  db.trim = null;
  vi.mocked(requireSalesCoachManager).mockResolvedValue(MGR);
  vi.mocked(getSession).mockResolvedValue(SESSION as never);
  vi.mocked(getSessionTranscript).mockResolvedValue(timed as never);
  vi.mocked(treeAllowsRep).mockResolvedValue(true);
});

describe("POST /api/coach/remote/:id/trim", () => {
  it("a rep is refused", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
    expect((await POST(...post({ startMs: 0, endMs: 5000 }))).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });
  it("a manager can't trim their own call", async () => {
    vi.mocked(getSession).mockResolvedValue({ ...SESSION, agentId: "m1" } as never);
    expect((await POST(...post({ startMs: 0, endMs: 5000 }))).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });
  it("a rep outside the manager's tree is not found", async () => {
    vi.mocked(treeAllowsRep).mockResolvedValue(false);
    expect((await POST(...post({ startMs: 0, endMs: 5000 }))).status).toBe(404);
    expect(db.inserts).toEqual([]);
  });
  it("refuses when a transcript line has no time (the words could not be found, so 'trimmed' would be untrue)", async () => {
    vi.mocked(getSessionTranscript).mockResolvedValue([...timed, { spokenAt: null }] as never);
    expect((await POST(...post({ startMs: 0, endMs: 5000 }))).status).toBe(409);
    expect(db.inserts).toEqual([]);
  });
  it("trims: one row, an audit row, a version copy, and the AI reads redone after the response", async () => {
    const res = await POST(...post({ startMs: 55_000, endMs: 70_000 }));
    expect(res.status).toBe(200);
    expect(db.inserts).toEqual([{ table: "recording_trims", row: { company_id: "co1", session_id: "s1", start_ms: 55_000, end_ms: 70_000, trimmed_by: "m1" } }]);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "recording.trim", objectId: "s1" }));
    expect(db.rpc).toEqual(["copy_transcript_version"]);
    expect(after).toHaveBeenCalledOnce();
    expect(await res.json()).toMatchObject({ ok: true, reprocessing: true });
  });
  it("restoring twice is a 409, with no audit row for the second", async () => {
    db.trim = { id: "00000000-0000-4000-8000-000000000001", start_ms: 1000, end_ms: 5000 };
    db.insertError = null;
    expect((await POST(...post({ restoreTrimId: "00000000-0000-4000-8000-000000000001" }))).status).toBe(200);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "recording.trim_restore" }));
    vi.mocked(recordAudit).mockClear();
    db.insertError = { code: "23505", message: "dup" };
    // the trim lookup succeeds; only the restore insert collides (recording_trim_restores_once)
    const res = await POST(...post({ restoreTrimId: "00000000-0000-4000-8000-000000000001" }));
    expect(res.status).toBe(409);
    expect(recordAudit).not.toHaveBeenCalled();
  });
  it("a malformed restore id is a 400, never a database error (review #7)", async () => {
    expect((await POST(...post({ restoreTrimId: "not-a-uuid" }))).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
});
