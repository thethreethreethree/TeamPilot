import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/recordings[?agentId=] — the Sessions tab's recordings list. Like /skills it
 * opens a MANAGER read of a named rep via ?agentId, crossing the self-only A18 boundary — and recordings are
 * call AUDIO, so the cross-person gate matters as much here. Previously untested. Locks: 401; onboarding-403;
 * a non-manager requesting another rep → 403 (no data read); a manager naming a cross-company/unknown rep →
 * 404 (never another tenant's audio); an authorized manager reads exactly the requested rep, and the admin
 * read is scoped by BOTH company_id and agent_id. isSalesCoachManager + canManagerViewRepSkills are real.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const setCaller = (userId: string | null, profilesById: Record<string, unknown>) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: profilesById[id] ?? null }) }),
      }),
    }),
  });

let eqCalls: Array<{ col: string; val: unknown }>;
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.not = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      chain.or = async () => ({ data: [], error: null }); // terminal → empty recordings → 200
      chain.gte = async () => ({ data: [], error: null });
      return chain;
    },
  });

const req = (agentId?: string) =>
  ({ url: `https://x/api/coach/sales-session/recordings${agentId ? `?agentId=${agentId}` : ""}` }) as unknown as Parameters<typeof GET>[0];

const MANAGER = { role: "admin", sales_coach_role: null, company_id: "co1" };
const MEMBER = { role: "member", sales_coach_role: null, company_id: "co1" };

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls = [];
  mockAdmin();
});

describe("GET /recordings — ?agentId manager-access gate (A18, call audio)", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, {});
    expect((await GET(req())).status).toBe(401);
  });

  it("403 before onboarding (no company)", async () => {
    setCaller("rep1", { rep1: { role: "member", company_id: null } });
    expect((await GET(req())).status).toBe(403);
  });

  it("self-read (no agentId) → 200, admin read scoped to the caller", async () => {
    setCaller("rep1", { rep1: MEMBER });
    expect((await GET(req())).status).toBe(200);
    expect(eqCalls).toContainEqual({ col: "agent_id", val: "rep1" });
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
  });

  it("403 when a NON-manager requests another rep's recordings — no data read", async () => {
    setCaller("rep1", { rep1: MEMBER, rep2: MEMBER });
    expect((await GET(req("rep2"))).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("404 when a manager names a cross-company / unknown rep", async () => {
    setCaller("boss", { boss: MANAGER /* rep99 absent → null target */ });
    expect((await GET(req("rep99"))).status).toBe(404);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("200 when an authorized manager reads a same-company rep — scoped to THAT rep + company", async () => {
    setCaller("boss", { boss: MANAGER, rep2: { company_id: "co1" } });
    expect((await GET(req("rep2"))).status).toBe(200);
    expect(eqCalls).toContainEqual({ col: "agent_id", val: "rep2" }); // the requested rep, not the caller
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" }); // tenant-scoped
  });
});
