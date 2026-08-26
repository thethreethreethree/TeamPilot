import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * GET /api/coach/sales-session/recording-purge-cron — purges old un-saved call recordings (audio bytes +
 * pointer). Previously untested. Pins the CRON_SECRET auth gate (503 when unset; 401 on a wrong/absent
 * Bearer — a public endpoint that must not be triggerable by anyone) and a no-leak 500 on a query failure
 * (unlike the RCD cron, which treats a missing table as purged:0, this one surfaces a generic 500).
 * constantTimeEqual is the real primitive; createAdminClient is mocked.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const req = (authHeader?: string) =>
  ({
    headers: {
      get: (k: string) => (k.toLowerCase() === "authorization" ? (authHeader ?? null) : null),
    },
  }) as unknown as Parameters<typeof GET>[0];

// Count-based retention: fetchAllPaged calls .from().select().not().eq().order().range(from,to). Return the rows on
// the first page only (fetchAllPaged stops when a page is short). An `error` makes fetchAllPaged throw → 500.
const adminRead = (o: { data?: unknown[]; error?: unknown }) => ({
  from: () => ({
    select: () => ({
      not: () => ({
        eq: () => ({
          order: () => ({
            range: async (from: number) =>
              from === 0 ? { data: o.data ?? [], error: o.error ?? null } : { data: [], error: null },
          }),
        }),
      }),
    }),
  }),
});
// N recordings for ONE rep, NEWEST-first (i=0 newest). Beyond KEEP_PER_REP=20, the oldest are purge-eligible.
const repRows = (n: number, opts: { malformedOldest?: boolean } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    company_id: "co1",
    agent_id: "a1",
    audio_asset_url:
      opts.malformedOldest && i === n - 1 ? "https://example.com/full/url.mp3" : `assets-v1/co1/s${i + 1}/recording.webm`,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  }));
const setAdmin = (v: unknown) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);

const OLD = process.env.CRON_SECRET;
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
  vi.clearAllMocks();
});

describe("GET /api/coach/sales-session/recording-purge-cron", () => {
  it("503 when CRON_SECRET is unset — purge stays disabled until configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent Bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });

  it("500 WITHOUT leaking when the purge query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = "s3cret";
    setAdmin(adminRead({ error: { message: "internal pg detail" } }));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });

  it("purges only the recordings BEYOND the rep's 20 most-recent (count-based retention), oldest first", async () => {
    // The founder 2026-08-26 count rule: keep each rep's 20 newest recordings; purge older ones (so a rep who
    // hasn't pitched recently still has a rolling window to pull from). 21 recordings → exactly the oldest (s21) is
    // beyond the window and purged, with its chunk cleanup; s1..s20 are untouched.
    process.env.CRON_SECRET = "s3cret";
    const removed: string[] = [];
    const listed: string[] = [];
    const updated: string[] = [];
    const rows = repRows(21);
    setAdmin({
      from: () => ({
        select: () => ({
          not: () => ({
            eq: () => ({
              order: () => ({
                range: async (from: number) => (from === 0 ? { data: rows, error: null } : { data: [], error: null }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: async (_col: string, val: string) => { updated.push(val); return { error: null }; } }),
      }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
          list: async (prefix: string) => { listed.push(prefix); return { data: [{ name: "0.webm" }], error: null }; },
        }),
      },
    });
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(1); // exactly the 1 beyond the 20-window
    expect(body.keepPerRep).toBe(20);
    expect(removed).toContain("co1/s21/recording.webm"); // the OLDEST recording, not the recent ones
    expect(listed).toContain("co1/s21/chunks"); // its chunks cleaned up
    expect(updated).toEqual(["s21"]); // ONLY s21 nulled — s1..s20 (the kept window) are untouched
  });

  it("does NOT purge a pointer of an UNRECOGNIZED shape — flags it malformed, never silently orphans the audio", async () => {
    // Retention integrity: a full-URL pointer (not the `${bucket}/...` shape this cron understands) must be
    // LEFT with its pointer intact + counted `malformed`, not nulled-and-counted-purged (the false-ok write
    // that would leave the audio PII alive forever while the run reports retention ran). No storage/update
    // mock is needed — a malformed row is skipped before either call.
    process.env.CRON_SECRET = "s3cret";
    // 21 recordings; the OLDEST (s21, beyond the 20-window) carries a full-URL pointer this cron can't verify.
    setAdmin(adminRead({ data: repRows(21, { malformedOldest: true }) }));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.malformed).toBe(1);
    expect(body.purged).toBe(0);
  });
});
