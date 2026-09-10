import { describe, it, expect } from "vitest";
import { interleaveByCompany } from "../sweepFairness";

/**
 * The recovery sweep takes oldest-first and stops at a per-run cap. Across all companies at
 * once that starves a tenant silently: one company with a large old backlog fills every run
 * forever, a second company's dropped calls are never reached, and their audio ages toward
 * the purge. Nothing errors — the sweep reports a healthy count every hour and the starved
 * tenant simply never appears in it.
 */

const c = (companyId: string | null, id: string) => ({ companyId, id });

describe("interleaveByCompany", () => {
  it("STOPS one company's backlog filling the whole run", () => {
    // Company A holds the four oldest calls. Under a cap of 5 and no interleaving, A takes
    // every slot and B is never reached — this run and every run after it.
    const rows = [
      c("A", "a1"),
      c("A", "a2"),
      c("A", "a3"),
      c("A", "a4"),
      c("B", "b1"),
      c("B", "b2"),
    ];
    const first5 = interleaveByCompany(rows).slice(0, 5).map((r) => r.id);
    expect(first5).toEqual(["a1", "b1", "a2", "b2", "a3"]);
    // The point of the whole module: B is served on this run, not in some later one.
    expect(first5).toContain("b1");
  });

  it("keeps OLDEST-FIRST within a company — the purge clock still decides", () => {
    // Input order is whatever the caller sorted by. Interleaving must not reshuffle a
    // company's own queue, or the call closest to losing its audio loses its priority.
    const rows = [c("A", "oldest"), c("A", "middle"), c("A", "newest")];
    expect(interleaveByCompany(rows).map((r) => r.id)).toEqual(["oldest", "middle", "newest"]);
  });

  it("loses nothing — every candidate comes back exactly once", () => {
    const rows = [c("A", "a1"), c("B", "b1"), c("A", "a2"), c("C", "c1"), c("B", "b2")];
    const out = interleaveByCompany(rows);
    expect(out).toHaveLength(rows.length);
    expect(new Set(out.map((r) => r.id)).size).toBe(rows.length);
  });

  it("a candidate with NO company is served in turn, not dropped", () => {
    // Dropping it here would make the sweep's own scanned count disagree with reality. The
    // caller skips it for its own reasons; this function does not decide that.
    const rows = [c(null, "n1"), c("A", "a1"), c(null, "n2")];
    const out = interleaveByCompany(rows).map((r) => r.id);
    expect(out).toHaveLength(3);
    expect(out).toContain("n1");
    expect(out).toContain("n2");
  });

  it("a company's place in the rotation is set by its OLDEST call", () => {
    // B's oldest call predates A's, so B goes first — the rotation inherits the caller's
    // ordering rather than imposing an alphabetical or arbitrary one.
    const rows = [c("B", "b-oldest"), c("A", "a-older"), c("B", "b2"), c("A", "a2")];
    expect(interleaveByCompany(rows).map((r) => r.id)).toEqual([
      "b-oldest",
      "a-older",
      "b2",
      "a2",
    ]);
  });

  it("handles one company, and nothing at all, without special-casing", () => {
    expect(interleaveByCompany([])).toEqual([]);
    expect(interleaveByCompany([c("A", "only")]).map((r) => r.id)).toEqual(["only"]);
  });
});
