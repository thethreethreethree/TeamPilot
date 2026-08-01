import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * GET /api/care/rcd/retention-cron — the ONLY delete path for RCD (customer PII scraped from third-party
 * channels). Previously untested. Pins the CRON_SECRET auth gate (503 when unset = purge disabled; 401 on
 * a wrong/absent Bearer — a public cron endpoint that must not be triggerable by anyone) and the honest
 * degrade when the RCD table read fails (0194 unapplied / read error → purged:0, no crash). constantTimeEqual
 * is the real primitive (tested separately); createAdminClient is mocked.
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

// admin.from("care_rcd_conversations").select().lt().order().limit() -> { data, error }
const adminRead = (o: { data?: unknown; error?: unknown }) => ({
  from: () => ({
    select: () => ({
      lt: () => ({ order: () => ({ limit: async () => ({ data: o.data ?? null, error: o.error ?? null }) }) }),
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

describe("GET /api/care/rcd/retention-cron", () => {
  it("503 when CRON_SECRET is unset — purge stays disabled until configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent Bearer token (public endpoint, not anyone-triggerable)", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });

  it("degrades honestly to purged:0 (no crash) when the RCD table read errors", async () => {
    process.env.CRON_SECRET = "s3cret";
    setAdmin(adminRead({ error: { message: "relation care_rcd_conversations does not exist" } }));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect((await res.json()).purged).toBe(0);
  });

  // Fuller mock for the purge loop: routes conversations (read + delete), media (read), and storage.remove.
  const fullAdmin = (o: {
    conversations: Array<{ id: string }>;
    media: Array<{ conversation_id: string; storage_path: string }>;
    removeError?: unknown;
    deleteError?: unknown;
  }) => ({
    from: (t: string) => {
      if (t === "care_rcd_conversations") {
        return {
          select: () => ({
            lt: () => ({ order: () => ({ limit: async () => ({ data: o.conversations, error: null }) }) }),
          }),
          delete: () => ({ eq: async () => ({ error: o.deleteError ?? null }) }),
        };
      }
      if (t === "care_rcd_media") {
        return { select: () => ({ in: async () => ({ data: o.media }) }) };
      }
      throw new Error(`unexpected table ${t}`);
    },
    storage: { from: () => ({ remove: async () => ({ error: o.removeError ?? null }) }) },
  });

  it("leaves the row (does NOT delete) when the byte-removal fails — bytes are never orphaned", async () => {
    process.env.CRON_SECRET = "s3cret";
    setAdmin(
      fullAdmin({
        conversations: [{ id: "c1" }],
        media: [{ conversation_id: "c1", storage_path: "p1" }],
        removeError: { message: "network error" }, // a REAL storage failure (not 'not found')
      })
    );
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(body.purged).toBe(0); // row NOT deleted while its bytes may still exist
    expect(body.storageErrors).toBe(1);
  });

  it("purges (removes bytes THEN deletes the row) on the happy path", async () => {
    process.env.CRON_SECRET = "s3cret";
    setAdmin(
      fullAdmin({
        conversations: [{ id: "c1" }],
        media: [{ conversation_id: "c1", storage_path: "p1" }],
        removeError: null,
        deleteError: null,
      })
    );
    const res = await GET(req("Bearer s3cret"));
    expect((await res.json()).purged).toBe(1);
  });
});
