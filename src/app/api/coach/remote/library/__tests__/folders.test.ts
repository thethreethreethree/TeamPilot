import { describe, it, expect, vi, beforeEach } from "vitest";

/** F12.6 / F9.16 (2026-11-25): a named folder in your own library ("Listen later"), found by name or created; note kept. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => null) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => ({ id: "s1", companyId: "co1", agentId: "rep1", audioDurationSeconds: 60, endedAt: null, startedAt: "2026-11-20T10:00:00Z" })) }));
vi.mock("@/lib/storage/assets", () => ({ assetUrlToStoragePath: () => "p", signAssetUrl: vi.fn(async () => "https://signed/a") }));
vi.mock("@/lib/coach/remote/library", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/library")>()),
  shareBySession: vi.fn(async () => new Map()),
}));
const st = vi.hoisted(() => ({
  lookups: [] as Array<[string, unknown]>,
  inserts: [] as Array<{ t: string; row: Record<string, unknown> }>,
  existing: [] as unknown[],
  events: [] as unknown[], // 0346 folder archive/restore rows
  folder: null as Record<string, unknown> | null, // the folder an archive/restore targets
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: false, error: null }), // 0337: no call is hidden in these tests
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "order", "limit"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => (t === "library_folders" && st.lookups.push([k, v]), b);
      b.insert = (row: Record<string, unknown>) => (st.inserts.push({ t, row }), b);
      b.maybeSingle = async () => ({ data: t === "library_folders" ? (st.folder ?? { id: "f-new" }) : { id: "item-1" }, error: null });
      b.then = (res: (v: unknown) => unknown) => res({ data: t === "library_folders" ? st.existing : t === "library_folder_events" ? st.events : [], error: null });
      b.range = async (f: number) => ({ data: f > 0 ? [] : t === "library_folder_events" ? st.events : [], error: null });
      return b;
    },
  }),
}));
import { POST } from "../route";

const add = (body: Record<string, unknown>) => POST(new Request("http://t/x", { method: "POST", body: JSON.stringify({ action: "add", sessionId: "s1", ...body }) }) as never);
beforeEach(() => {
  st.lookups = [];
  st.inserts = [];
  st.existing = [];
  st.events = [];
  st.folder = null;
});

describe("library folders by name", () => {
  it("'Listen later' in your own library: looked up by name for you, created on first use, with the note", async () => {
    const r = await add({ scope: "mine", folderName: "  Listen   later ", note: "before Friday's 1:1" });
    expect(r.status).toBe(200);
    expect(st.lookups).toEqual(expect.arrayContaining([["is_company", false], ["name", "Listen later"], ["owner_id", "u1"]]));
    expect(st.inserts.find((i) => i.t === "library_folders")!.row).toMatchObject({ owner_id: "u1", is_company: false, name: "Listen later" });
    expect(st.inserts.find((i) => i.t === "library_items")!.row).toMatchObject({ folder_id: "f-new", note: "before Friday's 1:1" });
  });
  it("no name: your 'Mine' folder, as before", async () => {
    await add({ scope: "mine" });
    expect(st.lookups).toContainEqual(["name", "Mine"]);
  });
  it("an existing folder of that name is reused, not duplicated", async () => {
    st.existing = [{ id: "f-old" }];
    await add({ scope: "mine", folderName: "Objections" });
    expect(st.inserts.some((i) => i.t === "library_folders")).toBe(false);
    expect(st.inserts.find((i) => i.t === "library_items")!.row).toMatchObject({ folder_id: "f-old" });
  });
});

describe("archiving a folder (0346, F12.6)", () => {
  const act = (action: string, folderId = "f1") => POST(new Request("http://t/x", { method: "POST", body: JSON.stringify({ action, folderId }) }) as never);
  it("the owner archives and restores their own folder; the event is recorded", async () => {
    st.folder = { id: "f1", owner_id: "u1", is_company: false };
    expect((await act("archive")).status).toBe(200);
    expect((await act("restore")).status).toBe(200);
    expect(st.inserts.filter((i) => i.t === "library_folder_events").map((i) => i.row)).toEqual([
      { company_id: "co1", folder_id: "f1", kind: "archive", actor_id: "u1" },
      { company_id: "co1", folder_id: "f1", kind: "restore", actor_id: "u1" },
    ]);
  });
  it("someone else's personal folder is not found; a company folder needs a manager", async () => {
    st.folder = { id: "f1", owner_id: "other", is_company: false };
    expect((await act("archive")).status).toBe(404);
    st.folder = { id: "f1", owner_id: "other", is_company: true };
    expect((await act("archive")).status).toBe(403); // requireSalesCoachManager → null in this file
    expect(st.inserts).toEqual([]);
  });
  it("adding to an archived folder brings it back instead of hiding the call", async () => {
    st.existing = [{ id: "f-old" }];
    st.events = [{ id: 5, folder_id: "f-old", kind: "archive" }];
    const r = await add({ scope: "mine", folderName: "Objections" });
    expect((await r.json()).restored).toBe(true);
    expect(st.inserts.find((i) => i.t === "library_folder_events")!.row).toMatchObject({ folder_id: "f-old", kind: "restore" });
  });
});
