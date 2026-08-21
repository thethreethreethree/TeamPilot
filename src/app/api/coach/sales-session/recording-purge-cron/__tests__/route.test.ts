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

// .from("coaching_sessions").select().not().eq().lt().order().limit() -> { data, error }
const adminRead = (o: { data?: unknown; error?: unknown }) => ({
  from: () => ({
    select: () => ({
      not: () => ({
        eq: () => ({
          lt: () => ({
            order: () => ({ limit: async () => ({ data: o.data ?? null, error: o.error ?? null }) }),
          }),
        }),
      }),
    }),
  }),
});
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

  it("purges a valid recording: removes the audio + its chunk objects, then nulls the pointer", async () => {
    // The happy path was previously untested. Covers the core purge AND the 2026-08-21 chunk cleanup — a
    // clean-Stopped session's incremental audio chunks (orphaned once persistRecording set audio_asset_url)
    // are removed here so they don't accumulate. Best-effort but consequential (a storage DELETE).
    process.env.CRON_SECRET = "s3cret";
    const removed: string[] = [];
    const listed: string[] = [];
    const updated: string[] = [];
    setAdmin({
      from: () => ({
        select: () => ({
          not: () => ({
            eq: () => ({
              lt: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ id: "s1", company_id: "co1", audio_asset_url: "assets-v1/co1/s1/recording.webm" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: async (_col: string, val: string) => { updated.push(val); return { error: null }; } }),
      }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
          list: async (prefix: string) => { listed.push(prefix); return { data: [{ name: "0.webm" }, { name: "1.webm" }], error: null }; },
        }),
      },
    });
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.purged).toBe(1);
    expect(removed).toContain("co1/s1/recording.webm"); // the final recording object
    expect(listed).toContain("co1/s1/chunks"); // the chunk prefix was listed (the cleanup)
    expect(removed).toContain("co1/s1/chunks/0.webm"); // and its chunk objects removed
    expect(updated).toContain("s1"); // pointer nulled last
  });

  it("does NOT purge a pointer of an UNRECOGNIZED shape — flags it malformed, never silently orphans the audio", async () => {
    // Retention integrity: a full-URL pointer (not the `${bucket}/...` shape this cron understands) must be
    // LEFT with its pointer intact + counted `malformed`, not nulled-and-counted-purged (the false-ok write
    // that would leave the audio PII alive forever while the run reports retention ran). No storage/update
    // mock is needed — a malformed row is skipped before either call.
    process.env.CRON_SECRET = "s3cret";
    setAdmin(adminRead({ data: [{ id: "s1", audio_asset_url: "https://example.com/full/url.mp3" }] }));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.malformed).toBe(1);
    expect(body.purged).toBe(0);
  });
});
