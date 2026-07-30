import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/save-recording — toggles the recording-retention flag (a RETENTION
 * control). Owner-or-manager gate + company-scoped write + honest 404. Locks: 401; 404 for a cross-company /
 * missing session (never confirms another tenant's session exists); 403 for a non-owner non-manager; 200 for
 * the owner with the write company-scoped. isSalesCoachManager is the real predicate; the update is captured.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

const captured: { eqs: Array<{ col: string; val: unknown }> } = { eqs: [] };
const mockAdmin = (session: unknown, updatedRows: Array<{ id: string }> | null) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.update = () => chain;
      chain.eq = (col: string, val: unknown) => {
        captured.eqs.push({ col, val });
        return chain;
      };
      chain.maybeSingle = async () => ({ data: session }); // the session read
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: updatedRows, error: null }); // the update
      return chain;
    },
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const REP = { company_id: "co1", role: "member", sales_coach_role: null };
const OTHER_REP = { company_id: "co1", role: "member", sales_coach_role: null };
const OWNED = { id: "sess1", agent_id: "rep1", company_id: "co1" };

beforeEach(() => {
  vi.clearAllMocks();
  captured.eqs = [];
});

describe("POST /save-recording", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    mockAdmin(OWNED, [{ id: "sess1" }]);
    expect((await POST(req({ saved: true }), ctx)).status).toBe(401);
  });

  it("404 when the session is cross-company / missing", async () => {
    setCaller("rep1", REP);
    mockAdmin({ id: "sess1", agent_id: "rep1", company_id: "coOTHER" }, [{ id: "sess1" }]);
    expect((await POST(req({ saved: true }), ctx)).status).toBe(404);
  });

  it("403 for a non-owner, non-manager", async () => {
    setCaller("rep2", OTHER_REP); // in the company but not the session's agent, not a manager
    mockAdmin(OWNED, [{ id: "sess1" }]);
    expect((await POST(req({ saved: true }), ctx)).status).toBe(403);
  });

  it("200 for the owner, write company-scoped", async () => {
    setCaller("rep1", REP);
    mockAdmin(OWNED, [{ id: "sess1" }]);
    expect((await POST(req({ saved: true }), ctx)).status).toBe(200);
    expect(captured.eqs).toContainEqual({ col: "company_id", val: "co1" }); // the write is tenant-scoped
  });
});
