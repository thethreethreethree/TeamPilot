import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/problems — behaviours pinned here:
 *  1. The Understanding-Gate refusal (a controlled DB-trigger message) is SURFACED as a 422 with gateHold:true
 *     — that's intentional (the UI explains the hold), NOT a leak (the Understanding Gate is structural).
 *  2. Any OTHER DB error returns a generic 500 that does NOT contain the raw message (CWE-209).
 *  3. The 404 honest-no-rows path.
 *  4. Input validation via the shared schemas (ProblemCreateSchema / ProblemLinkSchema / ProblemPatchSchema):
 *     signalIds is bounded (was unbounded — a 100k array became one oversized insert) and each id must be a
 *     uuid up front, rather than letting the FK reject non-uuids only after the payload was assembled.
 * The supabase client is faked.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));

import { createClient } from "@/lib/supabase/server";
import { POST, PUT, PATCH } from "../route";

const PID = "11111111-1111-4111-8111-111111111111";
const PID2 = "22222222-2222-4222-8222-222222222222";
const SIG = "33333333-3333-4333-8333-333333333333";

function fakeSb(opts: {
  updated?: Array<{ id: string }> | null;
  error?: unknown;
  insertErr?: unknown;
  linkErr?: unknown;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { company_id: "co1" } }) }) }) };
      }
      if (table === "problems") {
        return {
          // PATCH: update(patch).eq(id).select("id")
          update: () => ({
            eq: () => ({
              select: async () => ({ data: opts.updated ?? null, error: opts.error ?? null }),
            }),
          }),
          // POST: insert(row).select("id").single()
          insert: () => ({
            select: () => ({
              single: async () => ({ data: opts.insertErr ? null : { id: PID }, error: opts.insertErr ?? null }),
            }),
          }),
        };
      }
      if (table === "problem_signals") {
        // POST link + PUT link: insert(links) -> { error }
        return { insert: async () => ({ error: opts.linkErr ?? null }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const mock = (sb: unknown) => (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/problems", () => {
  it("updates a problem (200) when a row comes back", async () => {
    mock(fakeSb({ updated: [{ id: PID }] }));
    const res = await PATCH(req({ id: PID, title: "sharper title" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("SURFACES an Understanding-Gate hold as 422 with gateHold:true (intentional, not a leak)", async () => {
    mock(fakeSb({ error: { message: "Understanding Gate: needs >= 3 linked signals before surfacing" } }));
    const res = await PATCH(req({ id: PID, status: "surfaced" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.gateHold).toBe(true);
    expect(body.error).toMatch(/Understanding Gate/);
  });

  it("does NOT leak a raw DB error on a non-gate 500 (CWE-209)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock(fakeSb({ error: { code: "XX000", message: "internal pg detail: problems rls policy" } }));
    const res = await PATCH(req({ id: PID, title: "x" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Couldn't update the problem.");
    expect(JSON.stringify(body)).not.toContain("internal pg detail");
  });

  it("404 when no row was updated (RLS-dropped / not found — honest, not a false ok)", async () => {
    mock(fakeSb({ updated: [] }));
    expect((await PATCH(req({ id: PID2, title: "x" }))).status).toBe(404);
  });

  it("400 on a non-uuid id (rejected up front, not a DB round-trip)", async () => {
    mock(fakeSb({}));
    expect((await PATCH(req({ id: "nope", title: "x" }))).status).toBe(400);
  });

  it("400 on a non-canonical status (outside the problem-status enum)", async () => {
    mock(fakeSb({}));
    expect((await PATCH(req({ id: PID, status: "whatever" }))).status).toBe(400);
  });
});

describe("POST /api/problems — schema validation", () => {
  it("creates a draft problem (200) with valid fields", async () => {
    mock(fakeSb({}));
    const res = await POST(req({ kind: "bottleneck", title: "Slow reviews", signalIds: [SIG] }));
    expect(res.status).toBe(200);
    expect((await res.json()).problemId).toBe(PID);
  });

  it("400 on an oversized signalIds array (was unbounded → one huge insert)", async () => {
    mock(fakeSb({}));
    const many = Array.from({ length: 201 }, () => SIG);
    expect((await POST(req({ kind: "k", title: "t", signalIds: many }))).status).toBe(400);
  });

  it("400 when a signalId is not a uuid (rejected before assembling the insert)", async () => {
    mock(fakeSb({}));
    expect((await POST(req({ kind: "k", title: "t", signalIds: ["not-a-uuid"] }))).status).toBe(400);
  });

  it("400 on a missing/empty title", async () => {
    mock(fakeSb({}));
    expect((await POST(req({ kind: "k", title: "" }))).status).toBe(400);
  });
});

describe("PUT /api/problems — link-signals validation", () => {
  it("links signals (200) with a valid id + uuid signalIds", async () => {
    mock(fakeSb({}));
    expect((await PUT(req({ id: PID, signalIds: [SIG] }))).status).toBe(200);
  });

  it("400 on an oversized signalIds array", async () => {
    mock(fakeSb({}));
    const many = Array.from({ length: 201 }, () => SIG);
    expect((await PUT(req({ id: PID, signalIds: many }))).status).toBe(400);
  });

  it("400 on a non-uuid problem id", async () => {
    mock(fakeSb({}));
    expect((await PUT(req({ id: "p1", signalIds: [SIG] }))).status).toBe(400);
  });
});
