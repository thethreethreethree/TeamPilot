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
});
