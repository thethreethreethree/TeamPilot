import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * treeAccess (RSS Phase 0 step 8): the reporting-tree question asked by service-role routes, through the
 * CALLER's client. Pins the two failure modes, which differ on purpose: a missing function (0273 not applied)
 * is today's behaviour → allowed; any other failure → refused (an access check that can't be answered fails
 * closed). And the Bearer client is preferred over the cookie one.
 */
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  bearer: null as unknown,
  cookie: vi.fn(),
}));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => state.bearer }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.cookie() }));

import { treeAllowsRep, treeFilterReps } from "../treeAccess";

const req = new Request("http://t/api/x");

beforeEach(() => {
  state.rpc.mockReset();
  state.bearer = null;
  state.cookie.mockReset();
  state.cookie.mockReturnValue({ rpc: state.rpc });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("treeAllowsRep", () => {
  it("returns the database's verdict, asked by the caller", async () => {
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect(await treeAllowsRep(req, "rep-1")).toBe(false);
    expect(state.rpc).toHaveBeenCalledWith("rss_tree_allows", { rep: "rep-1" });
    state.rpc.mockResolvedValue({ data: true, error: null });
    expect(await treeAllowsRep(req, "rep-1")).toBe(true);
  });

  it("0273 not applied (function missing) → allowed, which is today's behaviour", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    expect(await treeAllowsRep(req, "rep-1")).toBe(true);
  });

  it("any other failure → refused, never allowed by accident", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await treeAllowsRep(req, "rep-1")).toBe(false);
    state.cookie.mockImplementation(() => {
      throw new Error("cookies() outside a request");
    });
    expect(await treeAllowsRep(req, "rep-1")).toBe(false);
  });

  it("a Bearer caller (phone, extension) is asked through their own token, not the cookie session", async () => {
    const bearerRpc = vi.fn(async () => ({ data: true, error: null }));
    state.bearer = { rpc: bearerRpc };
    expect(await treeAllowsRep(req, "rep-1")).toBe(true);
    expect(bearerRpc).toHaveBeenCalled();
    expect(state.cookie).not.toHaveBeenCalled();
  });
});

describe("treeFilterReps", () => {
  it("keeps only what the database allows, in the original order", async () => {
    state.rpc.mockResolvedValue({ data: ["c", "a"], error: null });
    expect(await treeFilterReps(req, ["a", "b", "c"])).toEqual(["a", "c"]);
    expect(state.rpc).toHaveBeenCalledWith("rss_tree_filter", { reps: ["a", "b", "c"] });
  });

  it("missing function → everyone (today); other failure → nobody", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "undefined function" } });
    expect(await treeFilterReps(req, ["a", "b"])).toEqual(["a", "b"]);
    state.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await treeFilterReps(req, ["a", "b"])).toEqual([]);
  });

  it("an empty list asks nothing", async () => {
    expect(await treeFilterReps(req, [])).toEqual([]);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
