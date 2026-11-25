import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/library (RSS Phase 5). Pins the consent rule: a peer receives a company item only while the
 * rep's consent stands, and never learns an unapproved one exists; the rep and a manager the tree allows see it
 * with its approval state; removed items are gone; peers cannot add to the company library.
 */
// 0337: no call is hidden in these tests (the hide's own rules are tested in hidePhrases.test.ts).
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenFrom: vi.fn(async () => new Set()), hiddenInCompanyFrom: vi.fn(async () => new Set()) }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const who = vi.hoisted(() => ({ userId: "peer", manager: false, tree: [] as string[] }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: who.userId, companyId: "co1" })) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({
  requireSalesCoachManager: vi.fn(async () => (who.manager ? { userId: who.userId, companyId: "co1" } : null)),
}));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids.filter((i) => who.tree.includes(i))) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => ({ id: "s1", companyId: "co1", agentId: "rep1", audioDurationSeconds: 60, endedAt: null, startedAt: "2026-11-20T10:00:00Z" })) }));
vi.mock("@/lib/storage/assets", () => ({ assetUrlToStoragePath: () => "p", signAssetUrl: vi.fn(async () => "https://signed/a") }));
const consent = vi.hoisted(() => ({ s1: false, s2: true }));
vi.mock("@/lib/coach/remote/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/library")>()),
  shareBySession: vi.fn(async (_a: unknown, _c: string, ids: string[]) =>
    new Map(ids.map((id) => [id, { pitchId: `p-${id}`, share: { shareable: consent[id as "s1" | "s2"] ?? false } }])),
  ),
}));

const DATA: Record<string, unknown[]> = {
  library_folders: [{ id: "f1", owner_id: "mgr1", is_company: true, name: "Team examples" }],
  library_items: [
    { id: "i1", folder_id: "f1", session_id: "s1", snippet_id: null, rep_id: "rep1", note: null, added_by: "mgr1", created_at: "2026-11-20T10:00:00Z" },
    { id: "i2", folder_id: "f1", session_id: "s2", snippet_id: null, rep_id: "rep2", note: null, added_by: "mgr1", created_at: "2026-11-20T09:00:00Z" },
    { id: "i3", folder_id: "f1", session_id: "s2", snippet_id: null, rep_id: "rep2", note: null, added_by: "mgr1", created_at: "2026-11-20T08:00:00Z" },
  ],
  library_item_removals: [{ item_id: "i3" }],
  coaching_sessions: [{ id: "s1", client_label: "Acme", context: "phone", started_at: "x", audio_asset_url: "assets/a" }, { id: "s2", client_label: "Beta", context: "video", started_at: "x", audio_asset_url: "assets/b" }],
  profiles: [{ id: "rep1", full_name: "Rae" }, { id: "rep2", full_name: "Sam" }, { id: "mgr1", full_name: "Mo" }],
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: false, error: null }), // 0337: no call is hidden in these tests
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit", "insert"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: null, error: null });
      b.then = (res: (v: unknown) => unknown) => res({ data: DATA[t] ?? [], error: null });
      return b;
    },
  }),
}));

import { GET, POST } from "../route";
const get = async () => (await GET(new Request("http://t/x?scope=company") as never)).json();

beforeEach(() => {
  who.userId = "peer";
  who.manager = false;
  who.tree = [];
});

describe("GET company library", () => {
  it("a peer gets only approved, non-removed items — the unapproved one is not even mentioned", async () => {
    const body = await get();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["i2"]);
    expect(body.items[0]).toMatchObject({ approved: true, canOpenCall: false, audioUrl: "https://signed/a" });
  });
  it("the rep sees their own unapproved item, marked as waiting", async () => {
    who.userId = "rep1";
    const body = await get();
    expect(body.items.find((i: { id: string }) => i.id === "i1")).toMatchObject({ approved: false, canOpenCall: true });
  });
  it("a manager sees what the tree allows, approved or not", async () => {
    who.userId = "mgr1";
    who.manager = true;
    who.tree = ["rep1"];
    const ids = (await get()).items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(["i1", "i2"]); // i2 via consent, i1 via the tree
  });
});

describe("POST add", () => {
  it("a non-manager cannot add to the company library", async () => {
    const res = await POST(new Request("http://t/x", { method: "POST", body: JSON.stringify({ action: "add", scope: "company", sessionId: "s1" }) }) as never);
    expect(res.status).toBe(403);
  });
  it("a clip shorter than a second is refused with the reason", async () => {
    const res = await POST(
      new Request("http://t/x", { method: "POST", body: JSON.stringify({ action: "add", scope: "mine", sessionId: "s1", clip: { startMs: 0, endMs: 500, title: "x" } }) }) as never,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET — an archived folder (0346, F12.6)", () => {
  it("its items leave the list; the folder is listed as archived so it can be restored", async () => {
    DATA.library_folder_events = [{ id: 1, folder_id: "f1", kind: "archive" }];
    who.userId = "mgr1";
    who.manager = true;
    who.tree = ["rep1", "rep2"];
    const body = await get();
    delete DATA.library_folder_events;
    expect(body.items).toEqual([]);
    expect(body.folders).toEqual([{ id: "f1", name: "Team examples", archived: true, canArchive: true }]);
  });
});
