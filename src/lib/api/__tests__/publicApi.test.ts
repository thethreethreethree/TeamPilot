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
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => st.hidden) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "in", "gte"]) q[m] = () => q;
      q.eq = (col: string, v: unknown) => (st.eqs.push([table, col, v]), q);
      q.maybeSingle = async () => ({ data: table === "api_keys" ? st.key : table === "profiles" ? st.maker : null, error: null });
      q.range = async () => ({ data: table === "coaching_sessions" ? st.sessions : table === "audit_log" ? st.audit : [], error: null });
      q.lt = (_c: string, v: unknown) => ((st.lt = v), q);
      q.limit = async () => ({ data: table === "audit_log" ? st.audit : [], error: null });
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
});

