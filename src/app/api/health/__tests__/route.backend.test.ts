import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

/**
 * /api/health with Supabase CONFIGURED — the branch the existing route.test.ts never reaches (it runs in demo mode).
 *
 * 2026-11-11: the project was suspended (402 exceed_storage_size_quota), nobody could sign in, and this endpoint
 * said "ok". These lock the route's consumption of the overallStatus verdict: down → 503, a quota at warn →
 * 200 "degraded", healthy → 200 "ok", and the public body carries percentages, not byte counts.
 */

const { probe, usage } = vi.hoisted(() => ({ probe: vi.fn(), usage: vi.fn() }));

vi.mock("@/lib/supabase/config", () => ({
  supabaseEnabled: true,
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_ANON_KEY: "anon",
}));
vi.mock("@/lib/system/liveBackendChecks", () => ({
  cachedProbe: (...a: unknown[]) => probe(...a),
  cachedUsage: (...a: unknown[]) => usage(...a),
}));

const GB = 1024 ** 3;

beforeEach(() => {
  probe.mockReset();
  usage.mockReset();
  delete process.env.SUPABASE_STORAGE_QUOTA_BYTES;
  delete process.env.SUPABASE_DB_QUOTA_BYTES;
});

describe("GET /api/health — live backend checks", () => {
  it("Supabase refusing (the 402 suspension) → 503, status down, its reason visible, usage not attempted", async () => {
    probe.mockResolvedValue({ reachable: false, httpStatus: 402, reason: "restricted: exceed_storage_size_quota" });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("down");
    expect(body.backend.supabase).toEqual({ reachable: false, httpStatus: 402, reason: "restricted: exceed_storage_size_quota" });
    expect(usage).not.toHaveBeenCalled();
    // The fields VersionWatcher and other readers rely on are still present on the failure path.
    expect(body.build).toBeDefined();
  });

  it("reachable, file storage at 75% of the free plan → 200, degraded, warn", async () => {
    probe.mockResolvedValue({ reachable: true, httpStatus: 200, reason: null });
    usage.mockResolvedValue({ storage_bytes: 0.75 * GB, db_bytes: 50 * 1024 ** 2 });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.backend.quota.fileStorage).toEqual({ level: "warn", pctUsed: 75, quotaSource: "default-free-plan" });
    expect(body.backend.quota.database.level).toBe("ok");
  });

  it("an env quota replaces the free-plan default (2 GB is critical on the free plan, ok on a 100 GB plan)", async () => {
    probe.mockResolvedValue({ reachable: true, httpStatus: 200, reason: null });
    usage.mockResolvedValue({ storage_bytes: 2 * GB, db_bytes: 50 * 1024 ** 2 });
    expect((await (await GET()).json()).backend.quota.fileStorage.level).toBe("critical");

    process.env.SUPABASE_STORAGE_QUOTA_BYTES = String(100 * GB);
    const body = await (await GET()).json();
    expect(body.status).toBe("ok");
    expect(body.backend.quota.fileStorage).toEqual({ level: "ok", pctUsed: 2, quotaSource: "env" });
  });

  it("usage cannot be measured (e.g. migration 0271 not applied) → degraded/unknown, not a false ok", async () => {
    probe.mockResolvedValue({ reachable: true, httpStatus: 200, reason: null });
    usage.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.backend.quota.fileStorage.level).toBe("unknown");
  });

  it("the public body never carries raw byte counts", async () => {
    probe.mockResolvedValue({ reachable: true, httpStatus: 200, reason: null });
    usage.mockResolvedValue({ storage_bytes: 123456789, db_bytes: 98765432 });
    const text = await (await GET()).text();
    expect(text).not.toContain("123456789");
    expect(text).not.toContain("98765432");
  });
});
