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

/**
 * IS ANYONE TOLD WHEN SOMETHING BREAKS (2026-10-02). Production had no Sentry DSN, so every report was dropped
 * and nothing said so. The flag mirrors the two init guards term for term (sentry.server.config.ts,
 * instrumentation-client.ts); each term is exercised on both sides (CLAUDE.md §2.2 drift guard).
 */
describe("GET /api/health — errorReporting mirrors the Sentry init guards", () => {
  const keys = ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  const flags = async () => ((await (await GET()).json()) as { capabilities: { errorReporting: { server: boolean; browser: boolean } } }).capabilities.errorReporting;

  it.each([
    [undefined, undefined, { server: false, browser: false }],
    ["https://k@o.ingest.sentry.io/1", undefined, { server: true, browser: false }],
    [undefined, "https://k@o.ingest.sentry.io/1", { server: true, browser: true }],
    ["https://k@o.ingest.sentry.io/1", "https://k@o.ingest.sentry.io/1", { server: true, browser: true }],
  ])("SENTRY_DSN=%s NEXT_PUBLIC_SENTRY_DSN=%s → %o", async (server, pub, expected) => {
    if (server === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = server;
    if (pub === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = pub;
    expect(await flags()).toEqual(expected);
  });
});

/** 2026-10-03: whether email can send is readable from outside, from the one shared verdict. */
describe("GET /api/health — email", () => {
  const keys = ["POSTMARK_SERVER_TOKEN", "CARE_EMAIL_HOST_DOMAIN"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  const email = async () => ((await (await GET()).json()) as { capabilities: { email: boolean } }).capabilities.email;

  it("false without Postmark, true with both values", async () => {
    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.CARE_EMAIL_HOST_DOMAIN;
    expect(await email()).toBe(false);
    process.env.POSTMARK_SERVER_TOKEN = "pm-token";
    process.env.CARE_EMAIL_HOST_DOMAIN = "mail.elostate.com";
    expect(await email()).toBe(true);
  });
});
