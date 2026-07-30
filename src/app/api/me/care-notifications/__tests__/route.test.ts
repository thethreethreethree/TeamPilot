import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/me/care-notifications — the per-user C.A.R.E notification preference (the "customer replied" toggle).
 * Locks: 401 unauth; GET reads the pref; PATCH updates it; and the A34 degrade path (migration 0204 absent →
 * GET reports degraded, PATCH returns a soft 409) so a missing column never 500s or silently drops the pref.
 * isMissingColumnError is the REAL pure guard; we feed it a genuine 42703 error.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, PATCH } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** GET reads via maybeSingle; PATCH awaits update().eq(). One chain serves both. */
const fakeClient = (opts: { selectResult?: unknown; updateError?: unknown }) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.update = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => opts.selectResult ?? { data: null, error: null };
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: opts.updateError ?? null });
      return chain;
    },
  });

const MISSING_COL = { code: "42703", message: 'column "care_notify_customer_reply" does not exist' };
const patchReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => vi.clearAllMocks());

describe("/api/me/care-notifications", () => {
  it("GET 401 unauthenticated", async () => {
    setAuth(null);
    fakeClient({});
    expect((await GET()).status).toBe(401);
  });

  it("GET returns the stored preference", async () => {
    setAuth({ userId: "u1", companyId: "co1" });
    fakeClient({ selectResult: { data: { care_notify_customer_reply: false }, error: null } });
    expect(await (await GET()).json()).toEqual({ customerReply: false });
  });

  it("GET degrades (customerReply:true, degraded:true) when the column is missing (0204 pending)", async () => {
    setAuth({ userId: "u1", companyId: "co1" });
    fakeClient({ selectResult: { data: null, error: MISSING_COL } });
    expect(await (await GET()).json()).toEqual({ customerReply: true, degraded: true });
  });

  it("PATCH updates the preference", async () => {
    setAuth({ userId: "u1", companyId: "co1" });
    fakeClient({ updateError: null });
    const res = await PATCH(patchReq({ customerReply: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, customerReply: false });
  });

  it("PATCH returns a soft 409 when the column is missing (never 500)", async () => {
    setAuth({ userId: "u1", companyId: "co1" });
    fakeClient({ updateError: MISSING_COL });
    expect((await PATCH(patchReq({ customerReply: true }))).status).toBe(409);
  });
});
