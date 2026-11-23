import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/v5/removeRecordingAudio", () => ({ removeRecordingAudio: vi.fn(), removeSessionChunks: vi.fn() }));
const db = vi.hoisted(() => ({
  log: [] as string[],
  matches: [] as unknown[],
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  audio: [] as unknown[],
  eraseError: null as unknown,
  requests: [] as unknown[],
  completions: [] as unknown[],
  completionsError: null as unknown,
  plans: [] as unknown[],
  planArgs: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {},
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.log.push(`rpc:${fn}`);
      if (fn === "rss_erasure_matches") return { data: db.matches, error: null, args };
      if (fn === "rss_erasure_day_plan_matches") return { data: db.plans, error: null };
      if (fn === "rss_erase_day_plans") {
        db.planArgs = args;
        return { data: (args.p_plans as unknown[]).length, error: null };
      }
      return { data: db.eraseError ? null : { sessions: (args.p_sessions as unknown[]).length }, error: db.eraseError };
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "not", "order", "limit"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => {
        if (table === "erasure_requests") return res({ data: db.requests, error: null });
        if (table === "erasure_completions") return res({ data: db.completionsError ? null : db.completions, error: db.completionsError });
        if (table === "profiles") return res({ data: [{ id: "ceo", full_name: "Casey CEO" }], error: null });
        return res({ data: table === "coaching_sessions" ? db.audio : [], error: null });
      };
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
import { removeRecordingAudio, removeSessionChunks } from "@/lib/coach/v5/removeRecordingAudio";
import { GET, POST } from "../route";
import { unfinishedRequests } from "@/lib/coach/remote/erasure";

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
  db.requests = [];
  db.completions = [];
  db.completionsError = null;
  db.plans = [];
  db.planArgs = null;
  vi.mocked(resolveApiAuth).mockResolvedValue(ADMIN as never);
  vi.mocked(removeRecordingAudio).mockResolvedValue({ ok: true, chunksRemoved: 0 });
  vi.mocked(removeSessionChunks).mockResolvedValue({ ok: true, removed: 0 });
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
    expect(db.log).toEqual(["rpc:rss_erasure_matches", "rpc:rss_erasure_day_plan_matches", "insert:erasure_requests", "rpc:rss_erase_sessions"]);
    const reqRow = db.inserts[0]!.row;
    expect(reqRow).toMatchObject({ company_id: "co1", requested_by: "ceo", match_kind: "phone", match_hint: "phone ••••0123" });
    expect(String(reqRow.match_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(reqRow)).not.toContain("5550100123"); // the identifier itself is never stored
    expect(removeRecordingAudio).toHaveBeenCalledOnce();
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "erasure.request", objectId: "req-1" }));
    expect(await res.json()).toMatchObject({ erased: 1, audioRemoved: 1 });
  });
  // 2026-11-23: §3.1.1 item 2 — recordings deleted, including live chunks of a call that never got a recording pointer.
  it("clears every asked call's own audio folder, including a call with no recording file", async () => {
    db.audio = [{ id: "s1", company_id: "co1", audio_asset_url: "assets-v1/co1/s1/recording.webm" }];
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1", "s2"] }));
    expect(res.status).toBe(200);
    expect(removeRecordingAudio).toHaveBeenCalledOnce(); // only s1 has a pointer
    expect(vi.mocked(removeSessionChunks).mock.calls.map((c) => c[1])).toEqual([
      { companyId: "co1", sessionId: "s1" },
      { companyId: "co1", sessionId: "s2" },
    ]);
  });
  it("a chunk folder that can't be cleared stops the erasure before the database is touched", async () => {
    vi.mocked(removeSessionChunks).mockResolvedValue({ ok: false, reason: "storage-failed", message: "listing chunks: boom" });
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s2"] }));
    expect(res.status).toBe(500);
    expect(db.log).not.toContain("rpc:rss_erase_sessions");
    expect((await res.json()).error).toMatch(/nothing else was erased/i);
  });
  it("no hashing key on the server: refused before anything is recorded or removed", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1"] }));
    expect(res.status).toBe(503);
    expect(db.inserts).toEqual([]);
    expect(removeRecordingAudio).not.toHaveBeenCalled();
  });
});

// OPEN.md 2026-11-20 review: a failed erasure leaves a request with no completion; Settings → Protection lists those.
const R = (id: string, hash: string, at: string) => ({ id, match_hash: hash, match_kind: "phone", match_hint: "phone x0123", requested_by: "ceo", created_at: at });
const NOW = Date.parse("2026-11-21T12:00:00Z");

describe("unfinishedRequests", () => {
  it("a request with no completion, older than the grace, is unfinished", () => {
    expect(unfinishedRequests([R("r1", "h", "2026-11-21T10:00:00Z")], new Set(), NOW).map((u) => u.id)).toEqual(["r1"]);
  });
  it("a completed request is not", () => {
    expect(unfinishedRequests([R("r1", "h", "2026-11-21T10:00:00Z")], new Set(["r1"]), NOW)).toEqual([]);
  });
  it("a LATER completed request for the same customer finishes it (the retry worked)", () => {
    const rows = [R("r1", "h", "2026-11-21T10:00:00Z"), R("r2", "h", "2026-11-21T10:05:00Z")];
    expect(unfinishedRequests(rows, new Set(["r2"]), NOW)).toEqual([]);
  });
  it("an EARLIER completion does not excuse a later failure, nor does another customer's", () => {
    const rows = [R("r1", "h", "2026-11-21T09:00:00Z"), R("r2", "h", "2026-11-21T10:00:00Z"), R("r3", "other", "2026-11-21T11:00:00Z")];
    expect(unfinishedRequests(rows, new Set(["r1", "r3"]), NOW).map((u) => u.id)).toEqual(["r2"]);
  });
  it("one still running (younger than the 6-minute grace — the route's maxDuration is 5) is not shown", () => {
    expect(unfinishedRequests([R("r1", "h", "2026-11-21T11:57:00Z")], new Set(), NOW)).toEqual([]);
  });
  it("never returns the hash", () => {
    expect(JSON.stringify(unfinishedRequests([R("r1", "secret-hash", "2026-11-21T10:00:00Z")], new Set(), NOW))).not.toContain("secret-hash");
  });
});

describe("GET /api/coach/remote/erasure", () => {
  const get = () => GET(new Request("http://x") as never);
  it("admins only", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ ...ADMIN, isAdmin: false } as never);
    expect((await get()).status).toBe(403);
  });
  it("lists the unfinished ones with who asked, and no hash", async () => {
    db.requests = [R("r1", "h-unfinished", "2026-11-01T10:00:00Z"), R("r2", "g", "2026-11-01T11:00:00Z")];
    db.completions = [{ request_id: "r2" }];
    const res = await get();
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.unfinished).toEqual([{ id: "r1", kind: "phone", hint: "phone x0123", createdAt: "2026-11-01T10:00:00Z", requestedBy: "Casey CEO" }]);
    expect(JSON.stringify(j)).not.toContain("h-unfinished");
  });
  it("a failed completion read is a 500 — never 'none finished', which would flag every erasure", async () => {
    db.requests = [R("r1", "h", "2026-11-01T10:00:00Z")];
    db.completionsError = { message: "boom" };
    expect((await get()).status).toBe(500);
  });
});

describe("day plans (0322)", () => {
  const PLAN = (id: number) => ({ plan_id: id, rep_id: "ceo", day: "2026-11-20" });
  it("find lists the plans that mention the customer — rep and day only, never the plan's words", async () => {
    db.plans = [PLAN(7)];
    const body = await (await POST(post({ action: "find", kind: "phone", value: "5550100123" }))).json();
    expect(body.dayPlans).toEqual([{ id: 7, repName: "Casey CEO", day: "2026-11-20" }]);
    expect(JSON.stringify(body.dayPlans)).not.toMatch(/dump|plan"|what/);
  });
  it("erase: confirmed plans first (the identifier as searched), then the calls", async () => {
    db.plans = [PLAN(7)];
    const r = await POST(post({ action: "erase", kind: "phone", value: "+1 555 010 0123", sessionIds: ["s1"], dayPlanIds: [7] }));
    expect(r.status).toBe(200);
    expect(db.log.slice(-2)).toEqual(["rpc:rss_erase_day_plans", "rpc:rss_erase_sessions"]);
    expect(db.planArgs).toMatchObject({ p_plans: [7], p_kind: "phone", p_value: "5550100123", p_complete: false });
  });
  it("a customer only in a day plan: erased, and the plan step completes the request", async () => {
    db.matches = [];
    db.plans = [PLAN(7)];
    const j = await (await POST(post({ action: "erase", kind: "client_label", value: "Betty Ross", sessionIds: [], dayPlanIds: [7] }))).json();
    expect(j).toMatchObject({ erased: 0, plansErased: 1 });
    expect(db.planArgs).toMatchObject({ p_complete: true });
    expect(db.log).not.toContain("rpc:rss_erase_sessions");
  });
  it("a plan the search did not return is refused, and nothing is written", async () => {
    db.plans = [PLAN(7)];
    expect((await POST(post({ action: "erase", kind: "phone", value: "5550100123", sessionIds: ["s1"], dayPlanIds: [8] }))).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
});

