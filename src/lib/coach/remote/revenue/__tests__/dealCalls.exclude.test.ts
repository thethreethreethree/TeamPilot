import { describe, it, expect, vi } from "vitest";

/** loadDealCalls `exclude` (review 2026-11-28): hidden calls are dropped BEFORE the newest are picked; a failed check fails the read. */
vi.mock("server-only", () => ({}));
const got = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("../dealCalls", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return real;
});
import { loadDealCalls } from "../dealCalls";

const db = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
    q.in = (_c: string, ids: string[]) => ((got.ids = ids), q);
    q.then = (r: (v: unknown) => unknown) => r({ data: table === "remote_prospect_calls" ? [{ session_id: "h1" }, { session_id: "ok1" }] : [], error: null });
    return q;
  },
} as never;

describe("loadDealCalls exclude", () => {
  it("asks for the calls left after the exclusion", async () => {
    await loadDealCalls(db, "d1", { exclude: async () => new Set(["h1"]) });
    expect(got.ids).toEqual(["ok1"]);
  });
  it("a check that throws fails the read rather than letting every call through", async () => {
    expect(await loadDealCalls(db, "d1", { exclude: async () => { throw new Error("boom"); } })).toBe("failed");
  });
});
