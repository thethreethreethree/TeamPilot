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
});
