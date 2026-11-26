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
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => st.hidden) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "in", "gte"]) q[m] = () => q;
      q.eq = (col: string, v: unknown) => (st.eqs.push([table, col, v]), q);
      q.maybeSingle = async () => ({ data: table === "api_keys" ? st.key : null, error: null });
      q.range = async () => ({ data: table === "coaching_sessions" ? st.sessions : [], error: null });
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
});
