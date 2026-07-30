import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/problems — previously untested. Two behaviours pinned here:
 *  1. The Understanding-Gate refusal (a controlled DB-trigger message) is SURFACED as a 422 with gateHold:true
 *     — that's intentional (the UI explains the hold), NOT a leak (the Understanding Gate is structural).
 *  2. Any OTHER DB error returns a generic 500 that does NOT contain the raw message (CWE-209).
 * Plus the 404 honest-no-rows path. The supabase client is faked.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { PATCH } from "../route";

/** PATCH updates problems and .select("id")s the result; configure the update outcome. */
function fakeSb(opts: { updated?: Array<{ id: string }> | null; error?: unknown }) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) };
      }
      // problems.update(patch).eq(id).select("id")
      return {
        update: () => ({
          eq: () => ({
            select: async () => ({ data: opts.updated ?? null, error: opts.error ?? null }),
          }),
        }),
      };
    },
  };
}

const mock = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/problems", () => {
  it("updates a problem (200) when a row comes back", async () => {
    mock(fakeSb({ updated: [{ id: "p1" }] }));
    const res = await PATCH(req({ id: "p1", title: "sharper title" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("SURFACES an Understanding-Gate hold as 422 with gateHold:true (intentional, not a leak)", async () => {
    mock(fakeSb({ error: { message: "Understanding Gate: needs >= 3 linked signals before surfacing" } }));
    const res = await PATCH(req({ id: "p1", status: "surfaced" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.gateHold).toBe(true);
    expect(body.error).toMatch(/Understanding Gate/);
  });

  it("does NOT leak a raw DB error on a non-gate 500 (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock(fakeSb({ error: { code: "XX000", message: "internal pg detail: problems rls policy" } }));
    const res = await PATCH(req({ id: "p1", title: "x" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Couldn't update the problem.");
    expect(JSON.stringify(body)).not.toContain("internal pg detail");
  });

  it("404 when no row was updated (RLS-dropped / not found — honest, not a false ok)", async () => {
    mock(fakeSb({ updated: [] }));
    expect((await PATCH(req({ id: "nope", title: "x" }))).status).toBe(404);
  });
});
