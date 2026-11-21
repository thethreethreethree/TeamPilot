import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ due: [] as unknown[], attempts: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: db.due, error: null }),
    from: () => ({ insert: async (row: Record<string, unknown>) => (db.attempts.push(row), { error: null }) }),
  }),
}));
vi.mock("@/lib/coach/remote/webhooks", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/webhooks")>()),
  sendSigned: vi.fn(async (url: string) => (url.includes("down") ? { ok: false, status: 503, error: "HTTP 503" } : { ok: true, status: 200, error: null })),
}));

import { GET } from "../route";

const req = (auth?: string) => ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? (auth ?? null) : null) } }) as never;
const due = (id: number, url: string, attempts = 0) => ({ delivery_id: id, company_id: "co1", endpoint_id: "ep", url, event: "session.scored", payload: {}, created_at: "2026-11-20T10:00:00Z", attempts });

beforeEach(() => {
  process.env.CRON_SECRET = "c";
  process.env.RSS_WEBHOOK_SIGNING_SECRET = "m";
  db.due = [];
  db.attempts = [];
});

describe("webhook send cron", () => {
  it("401 without the cron secret", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });
  it("503 without the signing secret: never sends unsigned", async () => {
    delete process.env.RSS_WEBHOOK_SIGNING_SECRET;
    db.due = [due(1, "https://a.example.com")];
    expect((await GET(req("Bearer c"))).status).toBe(503);
    expect(db.attempts).toEqual([]);
  });
  it("records each try as the next attempt number, with the real result", async () => {
    db.due = [due(1, "https://a.example.com", 0), due(2, "https://down.example.com", 2)];
    const body = await (await GET(req("Bearer c"))).json();
    expect(body).toMatchObject({ tried: 2, delivered: 1, failed: 1, bounded: false });
    expect(db.attempts).toEqual([
      { company_id: "co1", delivery_id: 1, attempt_no: 1, ok: true, status: 200, error: null },
      { company_id: "co1", delivery_id: 2, attempt_no: 3, ok: false, status: 503, error: "HTTP 503" },
    ]);
  });
});
