import { describe, it, expect, vi } from "vitest";
import type { AutoRouteContext } from "../autoRoute";

/**
 * Rule 3 — the uploader-department fallback — firing at all.
 *
 * THIS RULE HAS NEVER RUN. It reads `profile_departments`, which had a table, RLS, a read and two
 * writers since 0055 and **no caller**, so the table was permanently empty. The existing
 * `autoRoute.test.ts` sets `uploaderId: null` with the comment "skip Rule 3 (uploader-department
 * fallback)", so the suite has never exercised it either — the rule was untested because it was
 * untestable in practice, and unfireable because nothing could put a row in the table.
 *
 * The department-assign surface fills the table. This pins that the rule it exists for actually
 * does something once it is filled, which is the difference between the feature working and the
 * form saving.
 *
 * Its non-firing is invisible by construction — `ruleTrace` records `R3:` only when it matched —
 * so an assertion on the trace is the only way to tell "did not need to fire" from "could not".
 */

/** Per-table rows, so `profile_departments` can answer while everything else stays empty. */
const TABLE_ROWS: Record<string, unknown[]> = {};
/**
 * Per-table single rows, for the reads that end in `.maybeSingle()`.
 *
 * SEPARATE FROM `TABLE_ROWS` because the first version of this file conflated them, and the
 * fallback case below silently tested nothing: R2 reads the task with `.maybeSingle()`, the mock
 * always answered `null`, so R2 never matched, `departmentIds` stayed empty and R3 fired — which
 * the test then reported as R3 failing to respect its own guard. The fixture was wrong, not the
 * rule. A test whose setup cannot reach the state it describes is worse than no test.
 */
const SINGLE_ROWS: Record<string, unknown> = {};

vi.mock("@/lib/supabase/admin", () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.is = () => b;
    b.maybeSingle = async () => ({ data: SINGLE_ROWS[table] ?? null });
    b.then = (resolve: (v: { data: unknown[] }) => void) =>
      resolve({ data: TABLE_ROWS[table] ?? [] });
    return b;
  };
  return { createAdminClient: () => ({ from: (t: string) => builder(t) }) };
});

const { autoRouteFile } = await import("../autoRoute");

const ctx = (over: Partial<AutoRouteContext> = {}): AutoRouteContext => ({
  uploaderId: "u1",
  companyId: "c1",
  fileName: "file.pdf",
  mimeType: "application/pdf",
  source: "library",
  ...over,
});

const reset = () => {
  for (const k of Object.keys(TABLE_ROWS)) delete TABLE_ROWS[k];
  for (const k of Object.keys(SINGLE_ROWS)) delete SINGLE_ROWS[k];
};

describe("Rule 3 — the uploader's own department", () => {
  it("THE LOOP CLOSES — a file routes to the department its uploader is in", async () => {
    reset();
    TABLE_ROWS.profile_departments = [{ department_id: "d-sales" }];

    const r = await autoRouteFile(ctx());

    expect(r.departmentIds).toContain("d-sales");
    expect(r.ruleTrace).toContain("R3:uploader-dept-fallback=1");
  });

  it("does not fire when the uploader is in no department", async () => {
    // The state the product has been in since 0055. The rule is silent, and the silence is
    // indistinguishable from "another rule already matched" without this assertion.
    reset();
    TABLE_ROWS.profile_departments = [];

    const r = await autoRouteFile(ctx());

    expect(r.departmentIds).toEqual([]);
    expect(r.ruleTrace.some((t) => t.startsWith("R3:"))).toBe(false);
  });

  it("carries every department when the uploader is in more than one", async () => {
    reset();
    TABLE_ROWS.profile_departments = [{ department_id: "d-sales" }, { department_id: "d-ops" }];

    const r = await autoRouteFile(ctx());

    expect(r.departmentIds).toEqual(expect.arrayContaining(["d-sales", "d-ops"]));
    expect(r.ruleTrace).toContain("R3:uploader-dept-fallback=2");
  });

  it("is a FALLBACK — an earlier rule's department wins and R3 stays quiet", async () => {
    // The rule's own guard is `departmentIds.size === 0`. If that ever goes, an uploader's
    // department would be added alongside a department the upload explicitly named, and a file
    // would file itself in two places for reasons nobody asked for.
    reset();
    TABLE_ROWS.profile_departments = [{ department_id: "d-sales" }];
    // R2 reads the task with .maybeSingle() and then resolves the department BY NAME.
    SINGLE_ROWS.tasks = { department: "Operations", title: "Q3 rollout" };
    TABLE_ROWS.departments = [{ id: "d-explicit", name: "Operations" }];

    const r = await autoRouteFile(ctx({ linkedTaskId: "t1" }));

    expect(r.ruleTrace).toContain("R2:task-dept-inherit=d-explicit");

    expect(r.departmentIds).not.toContain("d-sales");
    expect(r.ruleTrace.some((t) => t.startsWith("R3:"))).toBe(false);
  });

  it("stays quiet for an anonymous upload", async () => {
    // A customer-session upload has no uploaderId. The rule must not throw or invent one.
    reset();
    TABLE_ROWS.profile_departments = [{ department_id: "d-sales" }];

    const r = await autoRouteFile(ctx({ uploaderId: null }));

    expect(r.departmentIds).toEqual([]);
    expect(r.ruleTrace.some((t) => t.startsWith("R3:"))).toBe(false);
  });
});
