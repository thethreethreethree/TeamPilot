import { describe, expect, it } from "vitest";
import { strictMutate, strictMutateOne } from "../strictUpdate";

/**
 * strictMutate / strictMutateOne are the shared safety library (A13) behind
 * data-layer writes: they turn Supabase's silent-success-on-zero-rows into a
 * thrown error, and — strictMutateOne — throw when a too-broad predicate would
 * affect MORE than one row (the exact class of the admin ?email= mass-write
 * incident). Pure functions; regression-locked here so that guard can't erode.
 */

// A minimal stand-in for the Supabase mutation result (a thenable).
const result = (r: { data: unknown[] | null; error: unknown }) =>
  Promise.resolve(r) as never;

describe("strictMutate", () => {
  it("throws with the context prefix when the query errors", async () => {
    await expect(
      strictMutate(result({ data: null, error: { message: "boom", code: "42501" } }), {
        context: "setStatus",
      })
    ).rejects.toThrow(/setStatus failed: boom.*42501/);
  });

  it("throws 'changed zero rows' when data is null (silent-failure guard)", async () => {
    await expect(
      strictMutate(result({ data: null, error: null }), { context: "setStatus" })
    ).rejects.toThrow(/changed zero rows/);
  });

  it("throws 'changed zero rows' when data is an empty array", async () => {
    await expect(
      strictMutate(result({ data: [], error: null }), { context: "setStatus" })
    ).rejects.toThrow(/changed zero rows/);
  });

  it("returns the rows when the write affected some", async () => {
    const rows = await strictMutate(result({ data: [{ id: "a" }], error: null }), {
      context: "setStatus",
    });
    expect(rows).toEqual([{ id: "a" }]);
  });
});

describe("strictMutateOne (mass-write guard)", () => {
  it("returns the single row when exactly one is affected", async () => {
    const row = await strictMutateOne(result({ data: [{ id: "a" }], error: null }), {
      context: "updateProfile",
    });
    expect(row).toEqual({ id: "a" });
  });

  it("THROWS when more than one row is affected (too-broad predicate)", async () => {
    // The admin ?email= incident's class: a broad predicate must never silently
    // write many rows — strictMutateOne turns that into a loud failure.
    await expect(
      strictMutateOne(result({ data: [{ id: "a" }, { id: "b" }], error: null }), {
        context: "updateProfile",
      })
    ).rejects.toThrow(/expected to affect exactly 1 row but affected 2/);
  });

  it("throws on zero rows as well", async () => {
    await expect(
      strictMutateOne(result({ data: [], error: null }), { context: "updateProfile" })
    ).rejects.toThrow(/changed zero rows/);
  });
});
