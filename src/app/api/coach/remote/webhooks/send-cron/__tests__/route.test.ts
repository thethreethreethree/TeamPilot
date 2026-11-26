import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ due: [] as unknown[], attempts: [] as Array<Record<string, unknown>>, claims: new Set<string>(), claimAt: "2026-11-20T10:00:00Z", claimBroken: false }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: db.due, error: null }),
    from: (table: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { created_at: db.claimAt }, error: null }) }) }) }) }),
      insert: async (row: Record<string, unknown>) => {
        if (table === "webhook_send_claims") {
          if (db.claimBroken) return { error: { code: "42P01", message: "missing" } };
          const k = `${row.delivery_id}:${row.attempt_no}`;
          if (db.claims.has(k)) return { error: { code: "23505", message: "dup" } };
          db.claims.add(k);
          return { error: null };
        }
        db.attempts.push(row);
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/coach/remote/webhooks", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/webhooks")>()),
  sendSigned: vi.fn(async (url: string) => (url.includes("down") ? { ok: false, status: 503, error: "HTTP 503" } : { ok: true, status: 200, error: null })),
}));

vi.mock("@/lib/coach/remote/crmExport", () => ({ buildCrmCall: vi.fn(async (_a: unknown, _c: string, sid: string) => ({ call: { id: sid }, brief: { summary: "built at send time" } })) }));

import { GET } from "../route";
import { sendSigned } from "@/lib/coach/remote/webhooks";

const req = (auth?: string) => ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? (auth ?? null) : null) } }) as never;
const due = (id: number, url: string, attempts = 0) => ({ delivery_id: id, company_id: "co1", endpoint_id: "ep", url, event: "session.scored", payload: {}, created_at: "2026-11-20T10:00:00Z", attempts });

beforeEach(() => {
  process.env.CRON_SECRET = "c";
  process.env.RSS_WEBHOOK_SIGNING_SECRET = "m";
  db.due = [];
  db.attempts = [];
  db.claims = new Set();
  db.claimAt = new Date().toISOString();
  db.claimBroken = false;
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

  it("a call.to_crm delivery is filled in at send time from the call's id (0330)", async () => {
    db.due = [{ ...due(9, "https://crm.example.com"), event: "call.to_crm", payload: { sessionId: "s1", sentBy: "r1" } }];
    await GET(req("Bearer c"));
    const sent = vi.mocked(sendSigned).mock.calls.at(-1)![2] as string;
    expect(JSON.parse(sent)).toMatchObject({ event: "call.to_crm", data: { call: { id: "s1" }, brief: { summary: "built at send time" } } });
  });
  it("an attempt another run already claimed is not sent again (0384)", async () => {
    db.due = [due(1, "https://a.example.com", 0)];
    db.claims.add("1:1");
    vi.mocked(sendSigned).mockClear();
    const body = await (await GET(req("Bearer c"))).json();
    expect(body).toMatchObject({ tried: 1, delivered: 0, skipped: 1 });
    expect(sendSigned).not.toHaveBeenCalled();
    expect(db.attempts).toEqual([]);
  });
  it("a claim left by a run that died (older than 10 minutes, no attempt) is recorded as a failed attempt, so the delivery moves on", async () => {
    db.due = [due(1, "https://a.example.com", 0)];
    db.claims.add("1:1");
    db.claimAt = new Date(Date.now() - 11 * 60_000).toISOString();
    await GET(req("Bearer c"));
    expect(db.attempts).toEqual([expect.objectContaining({ delivery_id: 1, attempt_no: 1, ok: false })]);
  });
  it("a claim that can't be written (not 'taken') sends nothing and fails the run loudly", async () => {
    db.due = [due(1, "https://a.example.com", 0)];
    db.claimBroken = true;
    vi.mocked(sendSigned).mockClear();
    const r = await GET(req("Bearer c"));
    expect(r.status).toBe(500);
    expect(sendSigned).not.toHaveBeenCalled();
  });
});
