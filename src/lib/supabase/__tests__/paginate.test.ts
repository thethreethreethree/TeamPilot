import { describe, it, expect } from "vitest";
import { fetchAllPaged } from "../paginate";

/**
 * Guards the 1000-row-truncation fix (Coach KPI): an unbounded read is capped at 1000 by
 * PostgREST, so KPI aggregates computed from it silently undercount past 1000 rows.
 * fetchAllPaged must return the FULL set and FAIL HONESTLY (throw), never a partial set.
 */

// An in-memory source that honours the .range(from, to) window, like PostgREST does.
function makeSource(rows: number[]) {
  return (from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null as { message: string } | null });
}

describe("fetchAllPaged", () => {
  it("fetches EVERY row across pages — past the 1000 cap (the whole point)", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const out = await fetchAllPaged<number>(makeSource(rows), { pageSize: 1000 });
    expect(out.length).toBe(2500); // not silently truncated to 1000
    expect(out[0]).toBe(0);
    expect(out[2499]).toBe(2499);
  });

  it("handles an exact page-boundary count (one extra empty page, still complete)", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => i);
    const out = await fetchAllPaged<number>(makeSource(rows), { pageSize: 1000 });
    expect(out.length).toBe(2000);
  });

  it("returns [] for an empty source", async () => {
    const out = await fetchAllPaged<number>(makeSource([]), { pageSize: 1000 });
    expect(out).toEqual([]);
  });

  it("THROWS on a read error — fails honestly, never returns a partial/empty set", async () => {
    const src = () => Promise.resolve({ data: null, error: { message: "boom" } });
    await expect(fetchAllPaged(src, { label: "team KPI sessions" })).rejects.toThrow(
      /team KPI sessions failed: boom/,
    );
  });

  it("enforces the maxRows backstop against a runaway fetch", async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => i);
    await expect(
      fetchAllPaged<number>(makeSource(rows), { pageSize: 1000, maxRows: 2000 }),
    ).rejects.toThrow(/exceeded 2000/);
  });
});
