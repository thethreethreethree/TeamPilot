import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The public read API (0378; Gong M31). Pinned: only a live key with the scope works; revoked or unknown is 401; the
 * daily limit is 429; every list statement pins the key's company; calls with an active hide are left out.
 */
const st = vi.hoisted(() => ({
  key: null as Record<string, unknown> | null,
  dayCount: 0,
  eqs: [] as Array<[string, string, unknown]>,
  sessions: [] as unknown[],
  hidden: new Set<string>(),
  usage: [] as unknown[],
  maker: { role: "CEO", status: "active" } as Record<string, unknown> | null,
  audit: [] as unknown[],
  lt: null as unknown,
  stats: [] as unknown[],
  people: [] as unknown[],
  pitches: [] as unknown[],
  items: [] as unknown[],
  selects: [] as Array<[string, string]>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => st.hidden) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["order", "in", "gte"]) q[m] = () => q;
      q.select = (cols: string) => (st.selects.push([table, cols]), q);
      q.eq = (col: string, v: unknown) => (st.eqs.push([table, col, v]), q);
      q.maybeSingle = async () => ({ data: table === "api_keys" ? st.key : table === "profiles" ? st.maker : null, error: null });
      q.range = async () => ({ data: table === "coaching_sessions" ? st.sessions : table === "audit_log" ? st.audit : table === "session_interaction_stats" ? st.stats : table === "profiles" ? st.people : table === "pitch_scores" ? st.pitches : table === "pitch_score_elements" ? st.items : [], error: null });
      q.lt = (_c: string, v: unknown) => ((st.lt = v), q);
      q.limit = async () => ({ data: table === "audit_log" ? st.audit : table === "profiles" ? st.people : [], error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: null, error: null, count: st.dayCount });
      q.insert = async (row: unknown) => (st.usage.push(row), { error: null });
      return q;
    },
  }),
}));
import { hashApiKey, newApiKey, underPerSecond } from "../publicApi";
import { readResource } from "../publicApiRead";

const KEY = `els_${"a".repeat(43)}`;
const req = (path: string, key = KEY) => new Request(`http://x${path}`, { headers: { authorization: `Bearer ${key}` } });
beforeEach(() => {
  st.key = { id: "k1", company_id: "co1", created_by: "admin-1", scopes: ["read"], revoked_at: null };
  st.dayCount = 0;
  st.maker = { role: "CEO", status: "active" };
  st.audit = [];
  st.lt = null;
  st.eqs = [];
  st.sessions = [];
  st.hidden = new Set();
  st.usage = [];
  st.stats = [];
  st.people = [];
  st.pitches = [];
  st.items = [];
  st.selects = [];
});

describe("public API keys", () => {
  it("a key is random and only its hash identifies it", () => {
    const a = newApiKey();
    const b = newApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.prefix).toBe(a.key.slice(0, 10));
  });
  it("no key, an unknown key, a revoked key → 401; a key without the scope → 403", async () => {
    expect((await readResource(new Request("http://x/api/v1/deals"), "deals")).status).toBe(401);
    st.key = null;
    expect((await readResource(req("/api/v1/deals"), "deals")).status).toBe(401);
    st.key = { id: "k1", company_id: "co1", created_by: "a", scopes: ["read"], revoked_at: "2026-11-01" };
    expect((await readResource(req("/api/v1/deals"), "deals")).status).toBe(401);
    st.key = { id: "k2", company_id: "co1", created_by: "a", scopes: ["mcp"], revoked_at: null };
    expect((await readResource(req("/api/v1/deals"), "deals")).status).toBe(403);
  });
  it("over the daily limit → 429", async () => {
    st.dayCount = 10_000;
    expect((await readResource(req("/api/v1/deals"), "deals")).status).toBe(429);
  });
  it("every list pins the key's company, and the request is recorded", async () => {
    for (const r of ["deals", "accounts", "contacts", "calls"] as const) {
      st.eqs = [];
      st.key = { id: `k-${r}`, company_id: "co1", created_by: "admin-1", scopes: ["read"], revoked_at: null }; // its own per-second window
      expect((await readResource(req(`/api/v1/${r}`), r)).status).toBe(200);
      expect(st.eqs.some(([t, col, v]) => t !== "api_keys" && t !== "api_usage" && col === "company_id" && v === "co1")).toBe(true);
    }
    expect(st.usage.length).toBeGreaterThanOrEqual(4);
  });
  it("calls with an active hide are left out", async () => {
    st.key = { id: "k-hidden", company_id: "co1", created_by: "admin-1", scopes: ["read"], revoked_at: null };
    st.sessions = [{ id: "s1" }, { id: "s2" }];
    st.hidden = new Set(["s2"]);
    const j = await (await readResource(req("/api/v1/calls"), "calls")).json();
    expect(j.data.map((x: { id: string }) => x.id)).toEqual(["s1"]);
  });
  it("per second: three pass, the fourth waits", () => {
    const t = 1_000_000;
    expect([0, 1, 2, 3].map((i) => underPerSecond("kx", t + i))).toEqual([true, true, true, false]);
    expect(underPerSecond("kx", t + 1500)).toBe(true);
  });
  it("the audit log (F31.5): pinned to the key's company, and only while the key's maker is still an admin", async () => {
    st.key = { ...st.key!, id: "k-audit-1" };
    expect((await readResource(req("/api/v1/audit"), "audit")).status).toBe(200);
    expect(st.eqs).toContainEqual(["audit_log", "company_id", "co1"]);
    expect(st.eqs).toContainEqual(["profiles", "id", "admin-1"]);
    st.maker = { role: "Member", status: "active" };
    st.key = { ...st.key!, id: "k-audit-2" }; // a fresh key each time: the per-second limit is per key
    expect((await readResource(req("/api/v1/audit"), "audit")).status).toBe(403);
    st.maker = { role: "CEO", status: "removed" };
    st.key = { ...st.key!, id: "k-audit-3" };
    expect((await readResource(req("/api/v1/audit"), "audit")).status).toBe(403);
  });
  it("the audit log keeps the API's own rule: hidden calls' rows are left out, free text and secrets are removed", async () => {
    st.key = { ...st.key!, id: "k-audit-4" };
    st.hidden = new Set(["hidden-call"]);
    st.audit = [
      { id: 9, actor_id: "a", action: "call.hide_phrase_add", object_type: "company", object_id: "co1", meta: { phrase: "card number", count: 2 }, created_at: "t" },
      { id: 8, actor_id: "a", action: "webhook.add", object_type: "webhook_endpoint", object_id: "w1", meta: { url: "https://x/hook?token=s3cret", events: ["deal.closed"] }, created_at: "t" },
      { id: 7, actor_id: "a", action: "recording.trim", object_type: "coaching_session", object_id: "hidden-call", meta: {}, created_at: "t" },
    ];
    const j = await (await readResource(req("/api/v1/audit"), "audit")).json();
    expect(j.data.map((r: { id: number }) => r.id)).toEqual([9, 8]);
    expect(j.data[0].meta).toEqual({ count: 2 });
    expect(JSON.stringify(j)).not.toContain("s3cret");
    expect(JSON.stringify(j)).not.toContain("card number");
    st.hidden = new Set();
  });
  it("the audit log pages by ?before=<id>, so a growing log never repeats rows", async () => {
    st.key = { ...st.key!, id: "k-audit-5" };
    await readResource(req("/api/v1/audit?before=100&limit=10"), "audit");
    expect(st.lt).toBe(100);
  });
  it("people (E7): pinned to the key's company, and no way to reach them in the answer", async () => {
    st.key = { ...st.key!, id: "k-users-1" };
    st.people = [{ id: "u1", full_name: "Ana", role: "Member", sales_coach_role: "rep", status: "active", manager_id: "m1", created_at: "t" }];
    const r = await readResource(req("/api/v1/users"), "users");
    expect(r.status).toBe(200);
    expect(st.eqs).toContainEqual(["profiles", "company_id", "co1"]);
    const j = await r.json();
    expect(j.data).toEqual([{ id: "u1", name: "Ana", role: "Member", salesCoachRole: "rep", status: "active", managerId: "m1", createdAt: "t" }]);
    expect(JSON.stringify(j)).not.toMatch(/email|phone/i);
  });
  it("stats (E7): 7/30/90 days only; pinned; a call with an active hide is left out; latest transcript version counts", async () => {
    st.key = { ...st.key!, id: "k-stats-1" };
    expect((await readResource(req("/api/v1/stats?days=14"), "stats")).status).toBe(400);
    st.key = { ...st.key!, id: "k-stats-2" };
    const row = (session_id: string, rep_id: string, v: number, talk: number) => ({ id: 1, session_id, rep_id, transcript_version: v, talk_ratio_time: talk, longest_rep_monologue_ms: null, longest_customer_story_ms: null, interactivity: null, patience_ms: null, rep_questions_per_hour: null });
    st.stats = [row("s1", "r1", 1, 0.9), row("s1", "r1", 2, 0.5), row("s2", "r1", 1, 0.7), row("hid", "r1", 1, 0.1)];
    st.hidden = new Set(["hid"]);
    st.people = [{ id: "r1", full_name: "Ana" }];
    const r = await readResource(req("/api/v1/stats?days=7"), "stats");
    expect(r.status).toBe(200);
    expect(st.eqs).toContainEqual(["session_interaction_stats", "company_id", "co1"]);
    const j = await r.json();
    expect(j.days).toBe(7);
    expect(j.reps).toEqual([expect.objectContaining({ repId: "r1", name: "Ana", calls: 2 })]);
    expect(j.reps[0].talkRatioTime).toBeCloseTo(0.6);
    expect(j.team.calls).toBe(2);
    st.hidden = new Set();
  });
  it("scores (E13): pinned; the verdict and each item's grade, never the transcript, audio, evidence or reason; hidden calls left out", async () => {
    st.key = { ...st.key!, id: "k-scores-1" };
    st.pitches = [
      { id: "p1", session_id: "s1", rep_id: "r1", recorded_at: "t", outcome: "won", base: 60, bonus: 5, violations: 0, total: 65, band: "good", qualifying: true, rubric_version: "v1", section_points: [{ id: "intro", points: 10 }], created_at: "t" },
      { id: "p2", session_id: "hid", rep_id: "r1", recorded_at: "t", outcome: null, base: 1, bonus: 0, violations: 0, total: 1, band: "low", qualifying: false, rubric_version: "v1", section_points: null, created_at: "t" },
      { id: "p3", session_id: null, rep_id: "r2", recorded_at: "t", outcome: null, base: 50, bonus: 0, violations: 0, total: 50, band: "ok", qualifying: true, rubric_version: "v1", section_points: null, created_at: "t" },
    ];
    st.items = [{ id: "e1", pitch_id: "p1", element_id: "made-up-item", grade: "hit", points: 4 }];
    st.hidden = new Set(["hid"]);
    const r = await readResource(req("/api/v1/scores"), "scores");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.data.map((x: { id: string }) => x.id)).toEqual(["p1", "p3"]); // a door pitch (no call) isn't hideable
    expect(j.data[0]).toMatchObject({ callId: "s1", total: 65, counts: true, items: [{ id: "made-up-item", label: "made-up-item", grade: "hit", points: 4 }] });
    expect(st.eqs).toContainEqual(["pitch_scores", "company_id", "co1"]);
    expect(st.eqs).toContainEqual(["pitch_score_elements", "company_id", "co1"]);
    const asked = st.selects.filter(([t]) => t === "pitch_scores" || t === "pitch_score_elements").map(([, c]) => c).join(",");
    expect(asked).not.toMatch(/transcript|audio_url|evidence|not_qualifying_reason/);
    st.hidden = new Set();
  });
  it("trusted addresses (E15): a key with a list works only from it; refused requests are recorded", async () => {
    st.key = { id: "k-ip-1", company_id: "co1", created_by: "admin-1", scopes: ["read"], revoked_at: null, allowed_ips: ["203.0.113.0/24"] };
    const at = (ip?: string) => new Request("http://x/api/v1/deals", { headers: { authorization: `Bearer ${KEY}`, ...(ip ? { "x-real-ip": ip } : {}) } });
    expect((await readResource(at("198.51.100.1"), "deals")).status).toBe(403);
    expect((await readResource(at(), "deals")).status).toBe(403);
    expect(st.usage).toContainEqual(expect.objectContaining({ key_id: "k-ip-1", status: 403 }));
    st.key = { ...st.key!, id: "k-ip-2" };
    expect((await readResource(at("203.0.113.9"), "deals")).status).toBe(200);
  });
});
