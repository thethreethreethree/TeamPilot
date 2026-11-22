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

// The recordings read orders by created_at then id (tie-break), so .order() chains before .range().
type RangeFn = (from: number) => Promise<unknown>;
const chainOrder = (range: RangeFn): { order: () => unknown; range: RangeFn } => ({ order: () => chainOrder(range), range });
// Count-based retention: fetchAllPaged calls .from().select().not().eq().order().order().range(from,to). Return the rows on
// the first page only (fetchAllPaged stops when a page is short). An `error` makes fetchAllPaged throw → 500.
const adminRead = (o: { data?: unknown[]; error?: unknown }) => ({
  from: () => ({
    select: () => ({
      not: () => ({
        eq: () => ({
          order: () => chainOrder(async (from: number) =>
            from === 0 ? { data: o.data ?? [], error: o.error ?? null } : { data: [], error: null }),
        }),
      }),
    }),
  }),
});
// N recordings for ONE rep, NEWEST-first (i=0 newest), seconds apart. `oldestDaysAgo` moves the OLDEST one back in time
// (D14's 90-day default only removes audio older than 90 days; a company's "last N" removes beyond its N).
const DAY = 86_400_000;
const repRows = (n: number, opts: { malformedOldest?: boolean; oldestDaysAgo?: number } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    company_id: "co1",
    agent_id: "a1",
    audio_asset_url:
      opts.malformedOldest && i === n - 1 ? "https://example.com/full/url.mp3" : `assets-v1/co1/s${i + 1}/recording.webm`,
    created_at: new Date(
      Date.now() - (opts.oldestDaysAgo !== undefined && i === n - 1 ? opts.oldestDaysAgo * DAY : i * 1000),
    ).toISOString(),
  }));
// RSS Phase 8 (0284): the cron first reads company_recording_settings (select → order → range). `retention` is what
// that read answers: rows, a missing table (0284 not applied), or an error. Default: no rows (D14: 90 days).
type Retention = { rows?: unknown[]; missing?: boolean; error?: string };
const withRetention = (v: Record<string, unknown>, r: Retention = {}) => ({
  ...v,
  from: (table: string) =>
    table === "company_recording_settings"
      ? {
          select: () => ({
            order: () => ({
              range: async (from: number) =>
                r.missing
                  ? { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.company_recording_settings' in the schema cache" } }
                  : r.error
                    ? { data: null, error: { message: r.error } }
                    : { data: from === 0 ? (r.rows ?? []) : [], error: null },
            }),
          }),
        }
      : (v.from as (t: string) => unknown)(table),
});
let retention: Retention = {};
const setAdmin = (v: unknown) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(withRetention(v as Record<string, unknown>, retention));

const OLD = process.env.CRON_SECRET;
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
  vi.clearAllMocks();
  retention = {};
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

  it("D14 default (no setting): purges only audio older than 90 days, with its chunks", async () => {
    // D14 decided 2026-11-23: 90 days, however many calls. 21 recordings, the oldest (s21) 91 days old → only s21 goes,
    // with its chunk cleanup; s1..s20 are untouched.
    process.env.CRON_SECRET = "s3cret";
    const removed: string[] = [];
    const listed: string[] = [];
    const updated: string[] = [];
    const rows = repRows(21, { oldestDaysAgo: 91 });
    setAdmin({
      from: () => ({
        select: () => ({
          not: () => ({
            eq: () => ({
              order: () => chainOrder(async (from: number) => (from === 0 ? { data: rows, error: null } : { data: [], error: null })),
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
    expect(body.purged).toBe(1); // exactly the one older than 90 days
    expect(body.defaultRetentionDays).toBe(90);
    expect(removed).toContain("co1/s21/recording.webm"); // the OLDEST recording, not the recent ones
    expect(listed).toContain("co1/s21/chunks"); // its chunks cleaned up
    expect(updated).toEqual(["s21"]); // ONLY s21 nulled — s1..s20 (the kept window) are untouched
  });

  // A fake that records what was removed and nulled, for the retention-setting cases.
  const purgeFake = (rows: unknown[], removed: string[], updated: string[]) => ({
    from: () => ({
      select: () => ({
        not: () => ({ eq: () => ({ order: () => chainOrder(async (from: number) => ({ data: from === 0 ? rows : [], error: null })) }) }),
      }),
      update: () => ({ eq: async (_c: string, val: string) => { updated.push(val); return { error: null }; } }),
    }),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
        list: async () => ({ data: [], error: null }),
      }),
    },
  });

  it("D14 default: many RECENT recordings are all kept — the default is no longer a count", async () => {
    process.env.CRON_SECRET = "s3cret";
    const removed: string[] = [];
    const updated: string[] = [];
    setAdmin(purgeFake(repRows(45, { oldestDaysAgo: 89 }), removed, updated));
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(0);
    expect(removed).toEqual([]);
  });

  it("a company's own setting (latest row) sets its window: keep 25 → 21 recordings purge nothing", async () => {
    process.env.CRON_SECRET = "s3cret";
    retention = { rows: [{ id: 1, company_id: "co1", keep_last_per_rep: 5 }, { id: 2, company_id: "co1", keep_last_per_rep: 25 }] };
    const removed: string[] = [];
    const updated: string[] = [];
    setAdmin(purgeFake(repRows(21), removed, updated));
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(0);
    expect(removed).toEqual([]);
    expect(body.companiesWithSetting).toBe(1);
  });

  it("a SMALLER setting purges more: keep 19 → the two oldest of 21 go", async () => {
    process.env.CRON_SECRET = "s3cret";
    retention = { rows: [{ id: 7, company_id: "co1", keep_last_per_rep: 19 }] };
    const removed: string[] = [];
    const updated: string[] = [];
    setAdmin(purgeFake(repRows(21), removed, updated));
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(2);
    expect(updated.sort()).toEqual(["s20", "s21"]);
  });

  it("FAILS CLOSED: unreadable settings purge nothing (a wrong window deletes audio a company chose to keep)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = "s3cret";
    retention = { error: "connection reset" };
    const removed: string[] = [];
    const updated: string[] = [];
    setAdmin(purgeFake(repRows(30), removed, updated));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(removed).toEqual([]);
    expect(updated).toEqual([]);
  });

  it("before 0284 is applied (no table) the D14 default of 90 days applies, and the response says so", async () => {
    process.env.CRON_SECRET = "s3cret";
    retention = { missing: true };
    const removed: string[] = [];
    const updated: string[] = [];
    setAdmin(purgeFake(repRows(21, { oldestDaysAgo: 120 }), removed, updated));
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(1);
    expect(body.retentionTable).toBe("not_applied");
  });

  it("does NOT purge a pointer of an UNRECOGNIZED shape — flags it malformed, never silently orphans the audio", async () => {
    // Retention integrity: a full-URL pointer (not the `${bucket}/...` shape this cron understands) must be
    // LEFT with its pointer intact + counted `malformed`, not nulled-and-counted-purged (the false-ok write
    // that would leave the audio PII alive forever while the run reports retention ran). No storage/update
    // mock is needed — a malformed row is skipped before either call.
    process.env.CRON_SECRET = "s3cret";
    // 21 recordings; the OLDEST (s21, past the 90-day default) carries a full-URL pointer this cron can't verify.
    setAdmin(adminRead({ data: repRows(21, { malformedOldest: true, oldestDaysAgo: 100 }) }));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.malformed).toBe(1);
    expect(body.purged).toBe(0);
  });
});
