import { describe, it, expect, vi } from "vitest";

const run = vi.hoisted(() => ({ calls: [] as unknown[], result: { ok: true, rows: [] as unknown[], truncated: false, narrower: false } as Record<string, unknown> }));
vi.mock("@/lib/coach/remote/search", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/search")>()),
  runCallSearch: vi.fn(async (_db: unknown, f: unknown) => (run.calls.push(f), run.result)),
}));
import { followStates, newMatches, NEW_CAP } from "../savedSearchFollow";

describe("followStates (0342)", () => {
  it("the latest follow/unfollow wins; since = the later of the follow and the last seen", () => {
    const m = followStates([
      { search_id: "a", kind: "follow", created_at: "2026-11-20T00:00:00Z" },
      { search_id: "a", kind: "seen", created_at: "2026-11-22T00:00:00Z" },
      { search_id: "b", kind: "follow", created_at: "2026-11-20T00:00:00Z" },
      { search_id: "b", kind: "unfollow", created_at: "2026-11-21T00:00:00Z" },
      { search_id: "c", kind: "seen", created_at: "2026-11-10T00:00:00Z" },
      { search_id: "c", kind: "follow", created_at: "2026-11-20T00:00:00Z" }, // seen before the follow → since = follow
    ]);
    expect(m.get("a")).toEqual({ following: true, since: "2026-11-22T00:00:00Z" });
    expect(m.get("b")).toEqual({ following: false, since: null });
    expect(m.get("c")).toEqual({ following: true, since: "2026-11-20T00:00:00Z" });
  });
  it("follow again after unfollow starts counting from the new follow", () => {
    const m = followStates([
      { search_id: "a", kind: "follow", created_at: "2026-11-01T00:00:00Z" },
      { search_id: "a", kind: "unfollow", created_at: "2026-11-05T00:00:00Z" },
      { search_id: "a", kind: "follow", created_at: "2026-11-24T00:00:00Z" },
    ]);
    expect(m.get("a")).toEqual({ following: true, since: "2026-11-24T00:00:00Z" });
  });
});

describe("newMatches (0342)", () => {
  it("runs the saved filters, Remote Sales only, counting calls that ENDED since (the saved dates still apply)", async () => {
    run.calls = [];
    run.result = { ok: true, rows: [1, 2], truncated: false };
    expect(await newMatches({} as never, "q=price&from=2026-11-01", "2026-11-20T00:00:00Z")).toEqual({ count: 2, capped: false });
    expect(run.calls[0]).toMatchObject({ q: "price", from: new Date("2026-11-01").toISOString(), endedAfter: "2026-11-20T00:00:00Z", remoteOnly: true });
  });
  it("a word search that hit its read cap is a floor (capped), not a confident count", async () => {
    run.result = { ok: true, rows: [], truncated: false, narrower: true };
    expect(await newMatches({} as never, "q=price", "2026-11-20T00:00:00Z")).toEqual({ count: 0, capped: true });
  });
  it("caps the count and says so; a failed run or a bad query is null", async () => {
    run.result = { ok: true, rows: Array.from({ length: NEW_CAP + 5 }, (_, i) => i), truncated: false };
    expect(await newMatches({} as never, "", "2026-11-20T00:00:00Z")).toEqual({ count: NEW_CAP, capped: true });
    run.result = { ok: false, status: 500, error: "x" };
    expect(await newMatches({} as never, "", "2026-11-20T00:00:00Z")).toBeNull();
    expect(await newMatches({} as never, "from=not-a-date", "2026-11-20T00:00:00Z")).toBeNull();
  });
});
