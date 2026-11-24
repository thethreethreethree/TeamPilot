import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/webhooks — admins only. Pinned (2026-11-23): a rep is refused; a failed delivery-history read is
 * said (historyUnreadable), not shown as "nothing sent yet"; a failed endpoint read is "try again", not "not found".
 */
type A = { data: unknown; error: { message: string; code?: string } | null };
const st = vi.hoisted(() => ({ ctx: null as unknown, answers: {} as Record<string, A> }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => st.ctx) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/coach/remote/webhooks", () => ({
  assertEndpointUrl: vi.fn(),
  webhooksConfigured: () => !!process.env.RSS_WEBHOOK_SIGNING_SECRET,
  endpointSecret: () => "secret",
  EndpointUrlError: class extends Error {},
  MAX_ATTEMPTS: 6,
  sendSigned: vi.fn(async () => ({ ok: true, status: 200, error: null })),
  WEBHOOK_EVENTS: ["session.scored"],
  webhookBody: () => "{}",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const answer = st.answers[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => answer;
      q.then = (r: (v: unknown) => unknown) => r(answer);
      return q;
    },
  }),
}));

import { GET, POST } from "../route";

const ADMIN = { userId: "u-ceo", companyId: "co1", isAdmin: true };
const EP = { id: "ep1", url: "https://hooks.example.com/x", events: ["session.scored"], active: true, created_at: "2026-11-20" };

beforeEach(() => {
  st.ctx = ADMIN;
  st.answers = {
    webhook_endpoints: { data: [EP], error: null },
    webhook_deliveries: { data: [], error: null },
  };
});

describe("webhooks", () => {
  it("a rep is refused", async () => {
    st.ctx = { ...ADMIN, isAdmin: false };
    expect((await GET(new Request("http://x") as never)).status).toBe(403);
  });

  it("lists endpoints; nothing sent yet is last: null and history readable", async () => {
    const body = await (await GET(new Request("http://x") as never)).json();
    expect(body).toMatchObject({ historyUnreadable: false, endpoints: [{ id: "ep1", last: null }] });
  });

  it("a failed delivery-history read is said, not shown as 'nothing sent yet'", async () => {
    st.answers.webhook_deliveries = { data: null, error: { message: "boom" } };
    const res = await GET(new Request("http://x") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ historyUnreadable: true });
  });

  it("a failed endpoint read is 'try again', not 'not found'", async () => {
    st.answers.webhook_endpoints = { data: null, error: { message: "boom" } };
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "secret", endpointId: "ep1" }) }) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/try again/i);
  });

  it("an endpoint that isn't there is still 'not found'", async () => {
    st.answers.webhook_endpoints = { data: null, error: null };
    expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "secret", endpointId: "nope" }) }) as never)).status).toBe(404);
  });
});
