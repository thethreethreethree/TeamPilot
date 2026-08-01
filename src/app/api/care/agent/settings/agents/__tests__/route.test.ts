import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/care/agent/settings/agents — grants/revokes is_support_agent (who can see customer
 * conversations). Previously untested. Pins the security-critical logic: the company-admin gate (403
 * for non-admins), the { id, isSupportAgent } validation, and — the important one — that the
 * service-role write is SCOPED to the admin's OWN company (`.eq("company_id", ctx.companyId)`), so an
 * admin cannot toggle support-agent status for a user in ANOTHER company (a cross-tenant write). Plus
 * a no-leak 500.
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  OPEN_CONVERSATION_STATUSES: ["open", "in_conversation", "awaiting_customer"],
}));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "../route";

const UUID = "11111111-1111-4111-8111-111111111111";

type AdminChain = {
  from: () => AdminChain;
  update: () => AdminChain;
  eq: (col: string, val: unknown) => AdminChain;
  then: (onF: (v: { error: unknown }) => unknown) => Promise<unknown>;
};
function makeAdmin(updateError: unknown) {
  const eqCalls: Array<[string, unknown]> = [];
  const chain: AdminChain = {
    from: () => chain,
    update: () => chain,
    eq: (col, val) => {
      eqCalls.push([col, val]);
      return chain;
    },
    then: (onF) => Promise.resolve({ error: updateError }).then(onF),
  };
  return { chain, eqCalls };
}

const setAuth = (a: unknown) =>
  (requireCareAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(a);
const setAdmin = (chain: AdminChain) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/care/agent/settings/agents", () => {
  it("403 for a non-admin caller", async () => {
    setAuth({ ok: true, isAdmin: false, companyId: "co1" });
    expect((await POST(req({ id: UUID, isSupportAgent: true }))).status).toBe(403);
  });

  it("400 on invalid body (non-uuid id, or missing isSupportAgent)", async () => {
    setAuth({ ok: true, isAdmin: true, companyId: "co1" });
    expect((await POST(req({ id: "nope", isSupportAgent: true }))).status).toBe(400);
    expect((await POST(req({ id: UUID }))).status).toBe(400);
  });

  it("admin grant SCOPES the service-role write to the admin's own company (no cross-tenant toggle)", async () => {
    setAuth({ ok: true, isAdmin: true, companyId: "co1" });
    const { chain, eqCalls } = makeAdmin(null);
    setAdmin(chain);
    const res = await POST(req({ id: UUID, isSupportAgent: true }));
    expect(res.status).toBe(200);
    // The load-bearing tenant guard: the UPDATE is filtered by BOTH the target id AND the admin's company.
    expect(eqCalls).toContainEqual(["id", UUID]);
    expect(eqCalls).toContainEqual(["company_id", "co1"]);
  });

  it("500 WITHOUT leaking on a DB error (CWE-209)", async () => {
    setAuth({ ok: true, isAdmin: true, companyId: "co1" });
    const { chain } = makeAdmin({ message: "internal pg detail" });
    setAdmin(chain);
    const res = await POST(req({ id: UUID, isSupportAgent: false }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal pg detail");
  });
});
