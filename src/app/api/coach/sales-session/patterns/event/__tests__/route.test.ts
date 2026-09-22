import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/patterns/event — the first writer `pattern_events` has ever had.
 *
 * WHY THIS ROUTE NEEDS ITS OWN TESTS MORE THAN MOST. 0258 gives the table NO RLS insert policy,
 * so there is no database behind this route to catch a mistake: it is the whole access rule. And
 * the rule is not "same company" — it is a per-kind split, because a rep marking their own
 * pattern coached makes the Stalled rule unfalsifiable and a manager ticking `rep_reviewed` turns
 * the acknowledgement tile into a record of their own opinion.
 *
 * Also locked: a manual close writes `patterns.fixed_at`, which is the column `statusOf` reads.
 * An event alone would leave four surfaces still calling the pattern open.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { POST } from "../route";

const mock = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

let inserted: Record<string, unknown> | null;
let updated: Record<string, unknown> | null;
let insertFails: boolean;
let patternRow: Record<string, unknown> | null;

const mockAdmin = () =>
  mock(createAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table === "patterns") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: patternRow }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({ is: async () => { updated = patch; return { error: null }; } }),
          }),
        };
      }
      return {
        insert: (row: Record<string, unknown>) => {
          inserted = row;
          return {
            select: () => ({
              maybeSingle: async () =>
                insertFails
                  ? { data: null, error: { message: 'violates check constraint "pattern_events_kind_check"' } }
                  : { data: { id: "e1", ...row }, error: null },
            }),
          };
        },
      };
    },
  });

const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  inserted = null;
  updated = null;
  insertFails = false;
  patternRow = { id: "p1", company_id: "co1", rep_id: "rep-1", fixed_at: null };
  mockAdmin();
  mock(resolveApiAuth).mockResolvedValue({ userId: "mgr-1", companyId: "co1", role: "admin" });
  mock(requireSalesCoachManager).mockResolvedValue({ userId: "mgr-1", companyId: "co1" });
});

describe("the boring guards", () => {
  it("401s an anonymous caller", async () => {
    mock(resolveApiAuth).mockResolvedValue(null);
    expect((await POST(req({ patternId: "p1", kind: "coached" }))).status).toBe(401);
  });

  it("400s with no pattern", async () => {
    expect((await POST(req({ kind: "coached" }))).status).toBe(400);
  });

  it("404s a pattern in another company, with the admin client doing the read", async () => {
    // The admin client bypasses RLS, so this check is the tenant boundary rather than a
    // convenience. Without it a manager could write into any pattern id in the database.
    patternRow = { id: "p1", company_id: "other-co", rep_id: "rep-1", fixed_at: null };
    expect((await POST(req({ patternId: "p1", kind: "coached" }))).status).toBe(404);
    expect(inserted).toBeNull();
  });

  it("refuses a note with nothing written in it", async () => {
    const res = await POST(req({ patternId: "p1", kind: "note", body: "   " }));
    expect(res.status).toBe(400);
    expect(inserted).toBeNull();
  });

  it("refuses an over-long note before the column does", async () => {
    const res = await POST(req({ patternId: "p1", kind: "note", body: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });
});

describe("the per-kind split, which is the whole access rule", () => {
  it("lets a manager mark a rep's pattern coached", async () => {
    const res = await POST(req({ patternId: "p1", kind: "coached" }));
    expect(res.status).toBe(200);
    expect(inserted).toMatchObject({ pattern_id: "p1", kind: "coached", actor_id: "mgr-1", company_id: "co1" });
  });

  it("REFUSES a rep marking their own pattern coached", async () => {
    // The defect this closes: "coached 7+ days ago with no change" is a claim that a human
    // intervened, and a rep who can assert it can clear their own Stalled status.
    mock(resolveApiAuth).mockResolvedValue({ userId: "rep-1", companyId: "co1", role: "member" });
    mock(requireSalesCoachManager).mockResolvedValue(null);
    const res = await POST(req({ patternId: "p1", kind: "coached" }));
    expect(res.status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("REFUSES a manager acknowledging on the rep's behalf", async () => {
    const res = await POST(req({ patternId: "p1", kind: "rep_reviewed" }));
    expect(res.status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("lets the rep acknowledge their own", async () => {
    mock(resolveApiAuth).mockResolvedValue({ userId: "rep-1", companyId: "co1", role: "member" });
    mock(requireSalesCoachManager).mockResolvedValue(null);
    const res = await POST(req({ patternId: "p1", kind: "rep_reviewed" }));
    expect(res.status).toBe(200);
    expect(inserted).toMatchObject({ kind: "rep_reviewed", actor_id: "rep-1" });
  });

  it("stamps the actor from the SESSION, never from the body", async () => {
    // A client-supplied actor is somebody else's name on a coaching note.
    await POST(req({ patternId: "p1", kind: "coached", actorId: "someone-else" }));
    expect(inserted).toMatchObject({ actor_id: "mgr-1" });
  });

  it("refuses an unknown kind before the CHECK constraint sees it", async () => {
    const res = await POST(req({ patternId: "p1", kind: "promoted" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Unknown action.");
  });
});

describe("a manual close", () => {
  it("writes fixed_at, because that is the column the resolver reads", async () => {
    // An event alone would leave `statusOf` — and the four surfaces consuming it — still
    // calling the pattern open.
    const res = await POST(req({ patternId: "p1", kind: "fixed" }));
    expect(res.status).toBe(200);
    expect(updated).toHaveProperty("fixed_at");
    expect((await res.json()).closed).toBe(true);
  });

  it("does NOT move the date of an already-closed pattern", async () => {
    // Restating when the rep fixed it would skew every days-to-fix average on Rep progress.
    patternRow = { id: "p1", company_id: "co1", rep_id: "rep-1", fixed_at: "2026-09-11T10:00:00Z" };
    const res = await POST(req({ patternId: "p1", kind: "fixed" }));
    expect(res.status).toBe(200);
    expect(updated).toBeNull();
    expect((await res.json()).closed).toBe(false);
  });

  it("does not touch fixed_at for any other kind", async () => {
    await POST(req({ patternId: "p1", kind: "coached" }));
    expect(updated).toBeNull();
  });
});

describe("a failed insert", () => {
  it("never returns the database's words", async () => {
    // The message can carry a constraint name or a row fragment, and this reaches a browser.
    insertFails = true;
    const res = await POST(req({ patternId: "p1", kind: "coached" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Could not record that.");
    expect(JSON.stringify(body)).not.toMatch(/check constraint/i);
  });
});
