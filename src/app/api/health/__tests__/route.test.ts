import { describe, it, expect, afterEach } from "vitest";
import { GET } from "../route";

/**
 * DRIFT GUARD — the /api/health `build.commit` contract that the forced auto-update depends on.
 *
 * VersionWatcher (the stale-client forced-update, 2026-08-13) fetches /api/health and reads
 * `d?.build?.commit` to compare the deployed commit against the baked one. If a future refactor of this
 * endpoint renames or moves that field, the read silently yields undefined → the forced-update stops
 * detecting stale clients and the "I still see the old version" class returns with no error. This locks
 * the producer side of that contract: the deployed commit is exposed at exactly `body.build.commit`.
 */
describe("GET /api/health — the build.commit contract VersionWatcher depends on", () => {
  const orig = process.env.VERCEL_GIT_COMMIT_SHA;
  afterEach(() => {
    if (orig === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = orig;
  });

  it("exposes the deployed commit at body.build.commit (the exact path VersionWatcher reads)", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "abc1234def5678";
    const res = await GET();
    expect(res.status).toBe(200); // always 200 — contents describe health
    const body = await res.json();
    expect(body.build.commit).toBe("abc1234def5678");
    expect(body.status).toBe("ok");
  });

  it("build.commit is null off-Vercel (no SHA) → VersionWatcher reads '' and no-ops (no false reload)", async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    const res = await GET();
    const body = await res.json();
    // VersionWatcher: String(d?.build?.commit ?? "").trim() === "" → shouldForceReload stays false. Null here
    // is the SAFE state (a missing commit must never look like a new deploy), so lock it too.
    expect(body.build.commit).toBeNull();
  });
});
