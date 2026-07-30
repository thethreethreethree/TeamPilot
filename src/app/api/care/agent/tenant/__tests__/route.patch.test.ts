import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PATCH /api/care/agent/tenant — the tenant-config save. Business-critical: it persists a company's whole
 * Jeff config (branding, product context, tone, and the new assistance guidance). These pin: the admin
 * gate, the camelCase→snake_case field mapping, and the A34 deferred-column behavior END-TO-END (a missing
 * migration for one column must NOT fail the save of the others).
 */
vi.mock("@/lib/api/careAgentAuth", () => ({ requireCareAgent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({ readBody: async (req: { json: () => Promise<unknown> }) => req.json() }));

import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "../route";

const setAuth = (a: unknown) => (requireCareAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(a);
const setAdmin = (c: unknown) => (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(c);
const ADMIN = { ok: true, isAdmin: true, companyId: "co1", agentId: "a1" };

/** Fake admin client that records every upsert payload and can fail the first upsert with a given error. */
function fakeAdmin(opts: { errorOnce?: unknown } = {}) {
  const calls: Record<string, unknown>[] = [];
  let failed = false;
  return {
    _calls: calls,
    from: () => ({
      upsert: (payload: Record<string, unknown>) => {
        calls.push(payload);
        return {
          select: () => ({
            single: async () => {
              if (!failed && opts.errorOnce) {
                failed = true;
                return { data: null, error: opts.errorOnce };
              }
              return { data: payload, error: null };
            },
          }),
        };
      },
    }),
  };
}
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/care/agent/tenant", () => {
  it("403 for a non-admin", async () => {
    setAuth({ ok: true, isAdmin: false, companyId: "co1", agentId: "a2" });
    setAdmin(fakeAdmin());
    expect((await PATCH(req({ aiAssistanceGuidance: "x" }))).status).toBe(403);
  });

  it("maps aiAssistanceGuidance → ai_assistance_guidance and saves", async () => {
    setAuth(ADMIN);
    const admin = fakeAdmin();
    setAdmin(admin);
    const res = await PATCH(req({ aiAssistanceGuidance: "Always acknowledge frustration first." }));
    expect(res.status).toBe(200);
    expect(admin._calls[0]?.ai_assistance_guidance).toBe("Always acknowledge frustration first.");
  });

  it("A34: a missing ai_assistance_guidance column drops it + retries so OTHER settings still save", async () => {
    setAuth(ADMIN);
    const admin = fakeAdmin({ errorOnce: { code: "42703", message: 'column "ai_assistance_guidance" does not exist' } });
    setAdmin(admin);
    const res = await PATCH(req({ aiAssistanceGuidance: "x", widgetGreeting: "Hi there" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.assistanceGuidanceDeferred).toBe(true);
    // The retry (2nd upsert) keeps the other setting but drops the missing column.
    expect(admin._calls[1]?.widget_greeting).toBe("Hi there");
    expect(admin._calls[1]?.ai_assistance_guidance).toBeUndefined();
  });
});
