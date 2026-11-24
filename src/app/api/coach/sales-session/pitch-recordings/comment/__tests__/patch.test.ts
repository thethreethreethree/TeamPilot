import { describe, it, expect, vi, beforeEach } from "vitest";

/** PATCH (0333): only the author edits or removes; a change is a new revision; a removed comment stays removed. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/coach/recordings/notifyRecording", () => ({ notifyRecordingEvent: vi.fn(), notifyCommentMention: vi.fn() }));
const db = vi.hoisted(() => ({
  comment: { id: "c1", company_id: "co1", author_id: "m1", body: "orig" } as Record<string, unknown> | null,
  last: null as Record<string, unknown> | null,
  inserts: [] as unknown[],
  filters: [] as Array<[string, string, unknown]>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => (db.filters.push([table, k, v]), b);
      b.maybeSingle = async () => ({ data: table === "recording_comments" ? db.comment : db.last, error: null });
      b.insert = async (row: unknown) => (db.inserts.push(row), { error: null });
      return b;
    },
  }),
}));
import { PATCH } from "../route";

const patch = (body: Record<string, unknown>) => PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ commentId: "c1", ...body }) }) as never);

beforeEach(() => {
  db.comment = { id: "c1", company_id: "co1", author_id: "m1", body: "orig" };
  db.last = null;
  db.inserts = [];
  db.filters = [];
});

describe("PATCH comment", () => {
  it("the author's edit is a new revision; the comment row is untouched", async () => {
    const res = await patch({ body: "  fixed  " });
    expect(await res.json()).toEqual({ ok: true, changed: true, removed: false });
    expect(db.inserts).toEqual([{ company_id: "co1", comment_id: "c1", author_id: "m1", body: "fixed", removed: false }]);
    expect(db.filters).toContainEqual(["recording_comments", "company_id", "co1"]);
  });
  it("removal is a revision with no text", async () => {
    await patch({ remove: true });
    expect(db.inserts).toEqual([{ company_id: "co1", comment_id: "c1", author_id: "m1", body: null, removed: true }]);
  });
  it("someone else's comment is refused", async () => {
    db.comment = { ...db.comment!, author_id: "m2" };
    expect((await patch({ body: "mine now" })).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });
  it("another company's (or a missing) comment is a 404", async () => {
    db.comment = null;
    expect((await patch({ body: "x" })).status).toBe(404);
  });
  it("a removed comment can't be brought back by an edit", async () => {
    db.last = { body: null, removed: true };
    expect((await patch({ body: "back" })).status).toBe(409);
    expect(db.inserts).toEqual([]);
  });
  it("no change: nothing written", async () => {
    db.last = { body: "same", removed: false };
    expect(await (await patch({ body: "same" })).json()).toEqual({ ok: true, changed: false });
    expect(db.inserts).toEqual([]);
  });
});
