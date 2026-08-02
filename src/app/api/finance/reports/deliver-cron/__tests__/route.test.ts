import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * GET /api/finance/reports/deliver-cron — scheduled-report delivery worker (0172). Previously untested.
 * Pins the CRON_SECRET auth gate (503 when unset; 401 on a wrong/absent Bearer) and — the regression this
 * suite exists for — that a THROW while recording a delivery outcome is contained to its own item and does
 * NOT abort the rest of the batch. That was a real bug: the fin_record_report_delivery rpc sat unguarded
 * inside the per-item catch with no outer try/catch, so one transient DB error silently dropped every
 * delivery scheduled after it. constantTimeEqual is the real primitive; createAdminClient + sendPushToUsers
 * are mocked.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/notifications/sender", () => ({ sendPushToUsers: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/notifications/sender";
import { GET } from "../route";

const req = (authHeader?: string) =>
  ({
    headers: {
      get: (k: string) => (k.toLowerCase() === "authorization" ? (authHeader ?? null) : null),
    },
  }) as unknown as Parameters<typeof GET>[0];

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const setAdmin = (v: unknown) => asMock(createAdminClient).mockReturnValue(v);

const OLD = process.env.CRON_SECRET;
afterEach(() => {
  if (OLD === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = OLD;
  vi.clearAllMocks();
});

describe("GET /api/finance/reports/deliver-cron", () => {
  it("503 when CRON_SECRET is unset — delivery stays disabled until configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent Bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req(undefined))).status).toBe(401);
  });

  it("a recording-rpc throw on one item does NOT abort the batch — every due item is still attempted", async () => {
    process.env.CRON_SECRET = "s3cret";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const due = [
      { schedule_id: "s1", company_id: "c", report_id: "r", recipient_id: "u1", report_name: "R1" },
      { schedule_id: "s2", company_id: "c", report_id: "r", recipient_id: "u2", report_name: "R2" },
      { schedule_id: "s3", company_id: "c", report_id: "r", recipient_id: "u3", report_name: "R3" },
    ];

    // The failure-recorder throws specifically for s2 (a transient DB hiccup while recording s2's outcome).
    // Pre-fix, this propagated out of the loop and s3 was never attempted.
    const rpc = vi.fn().mockImplementation((_name: string, args: { p_schedule?: string }) => {
      if (args?.p_schedule === "s2") throw new Error("db hiccup while recording");
      return Promise.resolve({ error: null });
    });
    setAdmin({
      from: () => ({ select: async () => ({ data: due, error: null }) }),
      rpc,
    });

    // s2's push fails (→ failure branch → the throwing 'failed' record); s1 + s3 succeed.
    asMock(sendPushToUsers).mockImplementation(async ({ userIds }: { userIds: string[] }) =>
      userIds[0] === "u2" ? { sent: 0 } : { sent: 1 }
    );

    const res = await GET(req("Bearer s3cret"));

    // The regression assertion: all three recipients were attempted despite the throw on s2 (batch not aborted).
    expect(asMock(sendPushToUsers).mock.calls.length).toBe(3);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { due: number; sent: number; failed: number };
    expect(body.due).toBe(3);
    expect(body.sent).toBe(2); // s1 + s3 delivered
    expect(body.failed).toBe(1); // s2 (no active subscription) counted, its recorder-throw swallowed + logged
  });
});
