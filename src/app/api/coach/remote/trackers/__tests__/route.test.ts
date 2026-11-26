import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/trackers (RSS Phase 3, migration 0276). Pins: only managers write; the company and author
 * are the manager's, never the body's; phrases are validated; deactivating names the company in the write; and
 * "scan recent calls" only scans reps the reporting tree lets this manager see.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/coach/remote/trackerScan", () => ({ scanSessionTrackers: vi.fn(async () => 2) }));
vi.mock("@/lib/coach/remote/smartTrackerScan", () => ({ scanSmartTrackers: vi.fn(async () => 1) }));
// after() runs once the response is sent; outside Next's request scope the test collects and runs it by hand.
const later = vi.hoisted(() => ({ fns: [] as Array<() => Promise<void>> }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<void>) => void later.fns.push(fn) }));

const db = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, unknown]> }>,
  sessions: [] as Array<{ id: string; agent_id: string; session_kind?: string | null }>,
  smartOn: 0,
  updateFound: true,
  ranges: [] as Array<[string, string, unknown]>, // 0344: gte/lt on the backfill list
  read: { kind: "keyword", draft: true, active: true } as Record<string, unknown>, // a plain read (0352 publish)
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | null = null;
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "neq", "order", "limit"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => (filters.push([k, v]), b);
      b.gte = (k: string, v: unknown) => (db.ranges.push(["gte", k, v]), b);
      b.lt = (k: string, v: unknown) => (db.ranges.push(["lt", k, v]), b);
      b.insert = (row: Record<string, unknown>) => (db.inserts.push(row), b);
      b.update = (p: Record<string, unknown>) => ((patch = p), b);
      b.maybeSingle = async () => {
        if (patch) {
          db.updates.push({ patch, filters: [...filters] });
          return { data: db.updateFound ? { id: "t1" } : null, error: null };
        }
        return { data: { id: "t-new", ...db.read }, error: null };
      };
      b.then = (res: (v: unknown) => unknown) => res({ data: db.sessions, count: db.smartOn, error: null });
      return b;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { scanSessionTrackers } from "@/lib/coach/remote/trackerScan";
import { scanSmartTrackers } from "@/lib/coach/remote/smartTrackerScan";
import { POST, PATCH } from "../route";

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const req = (body: unknown, method = "POST") =>
  new Request("http://t/api/coach/remote/trackers", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as never;
const MGR = { userId: "mgr1", companyId: "co1" };

beforeEach(() => {
  vi.clearAllMocks();
  db.inserts = [];
  db.updates = [];
  db.sessions = [];
  db.smartOn = 0;
  later.fns = [];
  db.read = { kind: "keyword", draft: true, active: true };
  db.updateFound = true;
  db.ranges = [];
  mock(requireSalesCoachManager).mockResolvedValue(MGR);
});

describe("POST /api/coach/remote/trackers", () => {
  it("a non-manager is refused and nothing is written", async () => {
    mock(requireSalesCoachManager).mockResolvedValue(null);
    expect((await POST(req({ name: "C", phrases: ["spectrum"] }))).status).toBe(403);
    expect(db.inserts).toEqual([]);
  });

  it("creates with the manager's company and id and normalised phrases, ignoring the body's", async () => {
    const res = await POST(req({ name: "Competitors", phrases: ["  Spectrum ", "spectrum", "XFINITY"], side: "customer", company_id: "evil" }));
    expect(res.status).toBe(201);
    expect(db.inserts).toEqual([
      { company_id: "co1", name: "Competitors", phrases: ["spectrum", "xfinity"], side: "customer", kind: "keyword", within_first_seconds: null, starts_on: null, ends_on: null, channels: null, draft: false, created_by: "mgr1" },
    ]);
  });

  it("call types (0361): one type is stored; both, or none sent, mean no limit; anything else is refused", async () => {
    await POST(req({ name: "Screen", phrases: ["share my screen"], channels: ["video"] }));
    expect(db.inserts[0]).toMatchObject({ channels: ["video"] });
    db.inserts = [];
    await POST(req({ name: "Both", phrases: ["spectrum"], channels: ["phone", "video"] }));
    expect(db.inserts[0]).toMatchObject({ channels: null });
    expect((await POST(req({ name: "Bad", phrases: ["xx"], channels: ["in_person"] }))).status).toBe(400);
  });

  it("a window in minutes is stored in seconds (0335); none means the whole call", async () => {
    await POST(req({ name: "Disclosure", phrases: ["recorded line"], side: "rep", withinFirstMinutes: 2 }));
    expect(db.inserts[0]).toMatchObject({ within_first_seconds: 120 });
    db.inserts = [];
    await POST(req({ name: "Comp", phrases: ["spectrum"] }));
    expect(db.inserts[0]).toMatchObject({ within_first_seconds: null });
    expect((await POST(req({ name: "Bad", phrases: ["xx"], withinFirstMinutes: 0.1 }))).status).toBe(400);
  });

  it("a one-character phrase is a 400 with the reason", async () => {
    const res = await POST(req({ name: "C", phrases: ["a"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too short/);
  });

  it("scan only scans calls of reps the tree lets this manager see", async () => {
    db.sessions = [{ id: "s1", agent_id: "r1" }, { id: "s2", agent_id: "r-outside" }];
    mock(treeFilterReps).mockResolvedValueOnce(["r1"]);
    const res = await POST(req({ action: "scan" }));
    expect(await res.json()).toEqual({ scanned: 1, hits: 2 });
    expect(mock(scanSessionTrackers).mock.calls.map((c) => c[0])).toEqual(["s1"]);
  });
});

describe("POST — smart trackers (0329)", () => {
  it("saves the examples as written (trimmed, deduped), then reads the last visible SALES calls for that tracker alone", async () => {
    db.sessions = [
      { id: "s1", agent_id: "r1", session_kind: "sales" },
      { id: "m1", agent_id: "r1", session_kind: "meeting" },
      { id: "s2", agent_id: "r-outside", session_kind: "sales" },
      { id: "s3", agent_id: "r1", session_kind: null },
    ];
    mock(treeFilterReps).mockResolvedValueOnce(["r1"]);
    const res = await POST(req({ name: "Locked in", kind: "smart", side: "customer", phrases: ["  We're locked into a contract ", "We're locked into a contract", "Our deal ends in June"] }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "t-new", backfilling: 2 });
    expect(db.inserts).toEqual([
      { company_id: "co1", name: "Locked in", phrases: ["We're locked into a contract", "Our deal ends in June"], side: "customer", kind: "smart", within_first_seconds: null, starts_on: null, ends_on: null, channels: null, draft: false, created_by: "mgr1" },
    ]);
    expect(scanSmartTrackers).not.toHaveBeenCalled(); // nothing before the response
    for (const f of later.fns) await f();
    expect(mock(scanSmartTrackers).mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ["s1", { onlyTrackerId: "t-new" }],
      ["s3", { onlyTrackerId: "t-new" }],
    ]);
  });

  it("the 11th smart tracker is refused with how to make room; nothing is written", async () => {
    db.smartOn = 10;
    const res = await POST(req({ name: "One more", kind: "smart", phrases: ["Can you call me next week"] }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/switch one off/);
    expect(db.inserts).toEqual([]);
  });

  it("an example too short to mean anything is a 400", async () => {
    const res = await POST(req({ name: "X", kind: "smart", phrases: ["ok"] }));
    expect(res.status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
});

describe("PATCH /api/coach/remote/trackers", () => {
  it("deactivates, scoped to the manager's company", async () => {
    const res = await PATCH(req({ id: "11111111-1111-4111-8111-111111111111" }, "PATCH"));
    expect(res.status).toBe(200);
    expect(db.updates[0]).toEqual({
      patch: { active: false },
      filters: [["id", "11111111-1111-4111-8111-111111111111"], ["company_id", "co1"]],
    });
  });

  it("another company's tracker is a 404", async () => {
    db.updateFound = false;
    expect((await PATCH(req({ id: "11111111-1111-4111-8111-111111111111" }, "PATCH"))).status).toBe(404);
  });
});

describe("POST — start and end dates (0344, F11.5)", () => {
  it("stores the dates; an end before the start is refused and nothing is written", async () => {
    expect((await POST(req({ name: "Campaign", phrases: ["promo"], startsOn: "2026-12-01", endsOn: "2026-12-31" }))).status).toBe(201);
    expect(db.inserts[0]).toMatchObject({ starts_on: "2026-12-01", ends_on: "2026-12-31" });
    db.inserts = [];
    expect((await POST(req({ name: "Bad", phrases: ["promo"], startsOn: "2026-12-31", endsOn: "2026-12-01" }))).status).toBe(400);
    expect((await POST(req({ name: "Bad", phrases: ["promo"], startsOn: "Dec 1" }))).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });
  it("a dated smart tracker reads back only calls inside its dates (end = through that whole day)", async () => {
    db.sessions = [{ id: "s1", agent_id: "r1" }];
    expect((await POST(req({ name: "Locked", phrases: ["We're locked in"], kind: "smart", startsOn: "2026-11-01", endsOn: "2026-11-15" }))).status).toBe(201);
    expect(db.ranges).toEqual([
      ["gte", "started_at", "2026-11-01T00:00:00Z"],
      ["lt", "started_at", "2026-11-16T00:00:00.000Z"],
    ]);
  });
});

describe("draft trackers (0352, F11.4)", () => {
  beforeEach(() => mock(requireSalesCoachManager).mockResolvedValue(MGR));

  it("a draft is saved as a draft, and a smart draft reads no calls and isn't held to the cap", async () => {
    db.smartOn = 99; // over the cap: a draft doesn't count against it
    db.sessions = [{ id: "c1", agent_id: "r1" }];
    const res = await POST(req({ name: "Locked in", phrases: ["We're locked into a contract"], side: "customer", kind: "smart", draft: true }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "t-new", draft: true });
    expect(db.inserts[0]).toMatchObject({ draft: true, kind: "smart" });
    expect(later.fns).toHaveLength(0); // no backfill
  });

  it("going live updates only a draft that is still on, in the manager's company", async () => {
    const res = await PATCH(req({ id: "11111111-1111-4111-8111-111111111111", action: "publish" }, "PATCH"));
    expect(res.status).toBe(200);
    const u = db.updates.at(-1)!;
    expect(u.patch).toEqual({ draft: false });
    expect(u.filters).toEqual(expect.arrayContaining([["company_id", "co1"], ["draft", true], ["active", true]]));
  });

  it("going live on something that isn't a live-able draft is a 404, not a silent success", async () => {
    db.updateFound = false;
    const res = await PATCH(req({ id: "11111111-1111-4111-8111-111111111111", action: "publish" }, "PATCH"));
    db.updateFound = true;
    expect(res.status).toBe(404);
  });

  it("switching off is still the default PATCH", async () => {
    await PATCH(req({ id: "11111111-1111-4111-8111-111111111111" }, "PATCH"));
    expect(db.updates.at(-1)!.patch).toEqual({ active: false });
  });

  it("a second Go live on a smart tracker already live is a 404, not the cap's 409 (review 2026-11-26)", async () => {
    db.read = { kind: "smart", draft: false, active: true };
    db.smartOn = 99;
    const res = await PATCH(req({ id: "11111111-1111-4111-8111-111111111111", action: "publish" }, "PATCH"));
    expect(res.status).toBe(404);
  });
});

