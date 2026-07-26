import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * RCD retention cron gate — the security property: no purge runs without the CRON_SECRET Bearer.
 * (The purge flow itself mirrors the verified recording-purge-cron: collect media paths → remove bytes
 * → delete rows, so bytes are never orphaned. This locks the gate, which is what must never regress —
 * an open purge endpoint would let anyone delete a tenant's captured conversations.)
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/care/rcd/retention-cron/route";
import { createAdminClient } from "@/lib/supabase/admin";

const OLD_ENV = process.env.CRON_SECRET;

// Minimal admin: the conversations query resolves to an empty batch → the route returns quickly.
function emptyAdmin() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.lt = () => b;
  b.order = () => b;
  b.limit = () => Promise.resolve({ data: [], error: null });
  return { from: () => b };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD_ENV;
});

function reqWith(auth?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) } } as never;
}

describe("GET /api/care/rcd/retention-cron — auth gate", () => {
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

  it("proceeds with the correct Bearer and reports the retention window", async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.RCD_RETENTION_DAYS = "30";
    vi.mocked(createAdminClient).mockReturnValue(emptyAdmin() as never);
    const res = await GET(reqWith("Bearer s3cret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.retentionDays).toBe(30);
    expect(json.purged).toBe(0);
    delete process.env.RCD_RETENTION_DAYS;
  });

  it("defaults the window to 90 days when RCD_RETENTION_DAYS is unset/invalid", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.RCD_RETENTION_DAYS;
    vi.mocked(createAdminClient).mockReturnValue(emptyAdmin() as never);
    const json = await (await GET(reqWith("Bearer s3cret"))).json();
    expect(json.retentionDays).toBe(90);
  });
});
