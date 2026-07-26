import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Recording-purge cron — this cron IRREVERSIBLY deletes call-recording audio, and it had ZERO tests.
 * Two properties must never regress:
 *   1. The CRON_SECRET auth gate (an open purge endpoint would let anyone delete recordings).
 *   2. The MALFORMED-POINTER GUARD (the "false-ok" prevention): `remove()` on an unrecognized path returns
 *      no error, so a naive purge would null the pointer + count it purged while the audio survives forever
 *      unreferenced. The cron must REFUSE to touch a row whose pointer it doesn't recognize, flag it
 *      `malformed`, and never attempt the delete. These tests lock exactly that.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/coach/sales-session/recording-purge-cron/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSETS_BUCKET } from "@/lib/storage/assets";

const OLD = process.env.CRON_SECRET;

function reqWith(auth?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) } } as never;
}

// Admin mock: the coaching_sessions select chain resolves to `rows`; storage.remove records its calls;
// the update chain resolves cleanly. `.update()` returns a distinct object so the select-chain `.eq`
// (chainable) and the update-chain `.eq` (terminal) don't collide.
function adminWith(rows: unknown[], opts: { removeError?: { message: string } } = {}) {
  const removeCalls: string[][] = [];
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.not = () => b;
  b.eq = () => b;
  b.lt = () => b;
  b.order = () => b;
  b.limit = () => Promise.resolve({ data: rows, error: null });
  b.update = () => ({ eq: () => Promise.resolve({ error: null }) });
  const admin = {
    from: () => b,
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          removeCalls.push(paths);
          return Promise.resolve({ error: opts.removeError ?? null });
        },
      }),
    },
  };
  return { admin, removeCalls };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
});

describe("recording-purge-cron — auth gate", () => {
  it("503 when CRON_SECRET is unset (disabled until configured)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(reqWith("Bearer whatever"));
    expect(res.status).toBe(503);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("401 with a wrong/absent Bearer — no DB touched", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(reqWith("Bearer nope"))).status).toBe(401);
    expect((await GET(reqWith(undefined))).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("recording-purge-cron — malformed-pointer guard (false-ok prevention)", () => {
  it("REFUSES to purge a row whose audio_asset_url isn't a recognized bucket path", async () => {
    process.env.CRON_SECRET = "s3cret";
    const { admin, removeCalls } = adminWith([
      { id: "s1", audio_asset_url: "https://external.example/orphan.mp3" }, // not `${ASSETS_BUCKET}/…`
    ]);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    const json = await (await GET(reqWith("Bearer s3cret"))).json();
    expect(json.malformed).toBe(1); // flagged, surfaced (never swallowed)
    expect(json.purged).toBe(0); // pointer NOT nulled
    expect(removeCalls).toHaveLength(0); // never attempted a delete on an unrecognized pointer
  });

  it("purges a well-formed bucket-relative pointer: removes the bytes, then nulls the pointer", async () => {
    process.env.CRON_SECRET = "s3cret";
    const { admin, removeCalls } = adminWith([
      { id: "s2", audio_asset_url: `${ASSETS_BUCKET}/company/rec.webm` },
    ]);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    const json = await (await GET(reqWith("Bearer s3cret"))).json();
    expect(json.purged).toBe(1);
    expect(json.malformed).toBe(0);
    expect(removeCalls).toEqual([["company/rec.webm"]]); // bucket-relative path, bytes removed first
  });
});
