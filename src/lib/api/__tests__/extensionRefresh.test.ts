import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshExtensionSession } from "@/lib/api/extensionRefresh";

/**
 * The shared Supabase-refresh handler both extension refresh routes call (one mechanism, not a fork). Its
 * branches: env not configured → 500; upstream renews → ok with tokens; upstream rejects / no access_token →
 * 401; upstream throws → 502; and the refresh-token fallback when Supabase omits a rotated one.
 */

const okFetch = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.example.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("refreshExtensionSession", () => {
  it("env not configured → 500", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const r = await refreshExtensionSession("old-refresh");
    expect(r).toEqual({ ok: false, status: 500, error: "Auth not configured." });
  });

  it("upstream renews → ok with the new tokens", async () => {
    vi.stubGlobal("fetch", okFetch({ access_token: "new-access", refresh_token: "new-refresh" }));
    const r = await refreshExtensionSession("old-refresh");
    expect(r).toEqual({ ok: true, accessToken: "new-access", refreshToken: "new-refresh" });
  });

  it("keeps the submitted refresh token when upstream omits a rotated one", async () => {
    vi.stubGlobal("fetch", okFetch({ access_token: "new-access" }));
    const r = await refreshExtensionSession("old-refresh");
    expect(r).toMatchObject({ ok: true, accessToken: "new-access", refreshToken: "old-refresh" });
  });

  it("upstream rejects (no access_token) → 401", async () => {
    vi.stubGlobal("fetch", okFetch({ error: "invalid_grant" }, false));
    const r = await refreshExtensionSession("old-refresh");
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("upstream unreachable (throws) → 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const r = await refreshExtensionSession("old-refresh");
    expect(r).toMatchObject({ ok: false, status: 502 });
  });
});
