import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/[id]/why — records the rep's own "why" hypothesis onto the immutable (append-only) event
 * chain, then the System's read built on it. Previously untested. Two boundaries here are DISTINCT from the
 * rest of the surface: (1) REP-ONLY — even a manager who can SEE the session may NOT submit a why (it would
 * subvert the rep-first mechanism), stricter than the usual manager-can-act gate; (2) OUTCOME-FIRST — no why
 * before the call's outcome is recorded (no consequence, nothing to explain). A regression on either would let
 * a bogus hypothesis onto the append-only chain. rateLimit is mocked; the LLM (generateSessionWhy) is mocked.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(),
  getSessionTranscript: vi.fn(async () => []),
}));
vi.mock("@/lib/coach/v5/salesWhy", () => ({ generateSessionWhy: vi.fn(async () => ({ hasSignal: false })) }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { getSession } from "@/lib/data/salesCoach";
import { POST, GET } from "../route";

const setAuth = (userId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  });

const inserts: unknown[] = [];
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      insert: async (row: unknown) => {
        inserts.push(row);
        return { error: null };
      },
    }),
  });

const ctx = { params: Promise.resolve({ id: "sess1" }) };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const HYP = "The person I pitched wasn't the decision maker.";

beforeEach(() => {
  vi.clearAllMocks();
  inserts.length = 0;
  mockAdmin();
  (getCurrentCompanyId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("co1");
  // Default: an accessible session owned by rep1, with an outcome recorded.
  (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    agentId: "rep1", outcome: "no_sale", clientLabel: "Acme", context: "in_person",
  });
});

describe("POST /why — rep-only + outcome-first", () => {
  it("401 unauthenticated", async () => {
    setAuth(null);
    expect((await POST(req({ hypothesis: HYP }), ctx)).status).toBe(401);
  });

  it("404 when the session isn't accessible", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await POST(req({ hypothesis: HYP }), ctx)).status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it("403 for a NON-owner — even a manager who can see it can't submit the rep's why", async () => {
    setAuth("boss"); // not the session's agent (rep1)
    const res = await POST(req({ hypothesis: HYP }), ctx);
    expect(res.status).toBe(403);
    expect(inserts).toHaveLength(0); // nothing written to the chain
  });

  it("400 when no outcome is recorded yet (outcome-first sequencing)", async () => {
    setAuth("rep1");
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      agentId: "rep1", outcome: null, clientLabel: "Acme", context: "in_person",
    });
    expect((await POST(req({ hypothesis: HYP }), ctx)).status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("200 for the owning rep with an outcome — appends the rep's hypothesis to the chain", async () => {
    setAuth("rep1");
    const res = await POST(req({ hypothesis: HYP }), ctx);
    expect(res.status).toBe(200);
    expect(inserts).toHaveLength(1); // the rep hypothesis (system why has no signal → not stored)
    expect(inserts[0]).toMatchObject({ actor: "rep1", payload: { hypothesis: HYP } });
  });
});

/**
 * GET /why — owner-or-manager read gate. readLatestWhy reads the rep's private why via the ADMIN
 * (RLS-bypassing) client, so the handler must enforce ownership in app code. Before this gate, any
 * company member (incl. a peer rep) could read another rep's why — more permissive than every sibling
 * Sessions read (/list restricts non-managers to their own agent_id). Mirror the subsystem: owner always;
 * otherwise only a manager (isSalesCoachManager). 404 for an unauthorized peer (no existence leak).
 */
// RLS client mock that also serves the profiles read the manager-check performs.
const setAuthWithProfile = (
  userId: string | null,
  profile: { role?: string | null; sales_coach_role?: string | null; company_id?: string | null } | null
) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: (t: string) => {
      if (t === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) };
      }
      throw new Error(`unexpected table ${t}`);
    },
  });
// Admin mock for readLatestWhy (GET reads the why events).
const mockAdminReadWhy = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: async () => ({
              data: [{ kind: "coach.session_why_recorded", payload: { hypothesis: HYP }, created_at: "2026-08-02T00:00:00Z" }],
            }),
          }),
        }),
      }),
    }),
  });

describe("GET /why — owner-or-manager read gate", () => {
  beforeEach(() => mockAdminReadWhy());

  it("401 unauthenticated", async () => {
    setAuthWithProfile(null, null);
    expect((await GET({} as never, ctx)).status).toBe(401);
  });

  it("200 for the owning rep — returns the why", async () => {
    setAuthWithProfile("rep1", { role: "Member", sales_coach_role: null, company_id: "co1" });
    const res = await GET({} as never, ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).repHypothesis).toBe(HYP);
  });

  it("200 for a NON-owner MANAGER (coaching visibility — mirrors /list)", async () => {
    setAuthWithProfile("boss", { role: "CEO", sales_coach_role: null, company_id: "co1" });
    expect((await GET({} as never, ctx)).status).toBe(200);
  });

  it("404 for a NON-owner NON-manager peer — and does NOT leak the why", async () => {
    setAuthWithProfile("rep2", { role: "Member", sales_coach_role: null, company_id: "co1" });
    const res = await GET({} as never, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(HYP);
  });
});
