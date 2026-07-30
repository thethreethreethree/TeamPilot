import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PATCH /api/resolutions — the durability-review surface, previously untested. Pins the load-bearing guarantees:
 *  - validation (id, observed_outcome >= 20 chars, durability enum);
 *  - the WRITE-ONCE promise (a reviewed resolution can't be re-reviewed -> 409) — the label-is-the-defense
 *    immutability the constitution names, previously enforced only in the UI until the server guard landed;
 *  - the honest race/no-rows 409 and the 404 not-accessible path;
 *  - a real DB error yields a generic 500 with no raw leak (CWE-209).
 * The supabase client is faked; there are no @file mentions in the outcome, so the citation block is a no-op.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { PATCH } from "../route";

type Opts = {
  user?: { id: string } | null;
  existing?: { id: string; reviewed_at: string | null } | null;
  updated?: Array<{ id: string }> | null;
  updateError?: unknown;
};

function fakeSb(o: Opts) {
  return {
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1" } : o.user } }) },
    from: (table: string) => {
      if (table === "resolutions") {
        return {
          // existing-check: .select().eq().maybeSingle()
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: o.existing ?? null }) }) }),
          // write: .update().eq().is().select()
          update: () => ({
            eq: () => ({
              is: () => ({ select: async () => ({ data: o.updated ?? null, error: o.updateError ?? null }) }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) };
      }
      // files/events — not reached with a mention-free outcome
      return {
        select: () => ({ in: () => ({ is: async () => ({ data: [] }) }) }),
        insert: async () => ({ error: null }),
      };
    },
  };
}

const mock = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];
const OUTCOME = "The deal reopened after two weeks over a pricing dispute."; // >= 20 chars, no @mentions

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/resolutions", () => {
  it("401 unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "held" }))).status).toBe(401);
  });

  it("400 when observed outcome is too short (< 20 chars)", async () => {
    mock(fakeSb({}));
    expect((await PATCH(req({ id: "r1", observedOutcome: "good", durability: "held" }))).status).toBe(400);
  });

  it("400 on an invalid durability value", async () => {
    mock(fakeSb({}));
    expect((await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "great" }))).status).toBe(400);
  });

  it("404 when the resolution isn't accessible", async () => {
    mock(fakeSb({ existing: null }));
    expect((await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "held" }))).status).toBe(404);
  });

  it("409 WRITE-ONCE: a resolution already reviewed can't be re-reviewed", async () => {
    mock(fakeSb({ existing: { id: "r1", reviewed_at: "2026-07-01T00:00:00Z" } }));
    const res = await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "reopened" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already been reviewed/i);
  });

  it("409 when a concurrent review won the race (update matched 0 rows)", async () => {
    mock(fakeSb({ existing: { id: "r1", reviewed_at: null }, updated: [] }));
    expect((await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "held" }))).status).toBe(409);
  });

  it("200 when the review lands (unreviewed → exactly one row written)", async () => {
    mock(fakeSb({ existing: { id: "r1", reviewed_at: null }, updated: [{ id: "r1" }] }));
    const res = await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "held" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("500 on a DB error WITHOUT leaking the raw message (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock(
      fakeSb({
        existing: { id: "r1", reviewed_at: null },
        updateError: { code: "XX000", message: "internal pg detail: resolutions rls" },
      })
    );
    const res = await PATCH(req({ id: "r1", observedOutcome: OUTCOME, durability: "held" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Couldn't submit the review.");
    expect(JSON.stringify(body)).not.toContain("internal pg detail");
  });
});
