import { describe, it, expect, vi } from "vitest";
import type { AutoRouteContext } from "../autoRoute";

/**
 * autoRouteFile is the deterministic file-classification router (no LLM). The DB-derived rules (task/dept
 * inheritance) need fixtures, but the highest-churn, most-edge-case-prone logic is PURE: filename → title
 * (Rule 4) and filename → tags (Rule 5), plus the C.A.R.E tag (Rule 6). We exercise those through a
 * library-source upload with an empty DB (no departments/tasks), so the pure derivations are what's under test.
 */

// Empty DB for every table: departments/tasks/topics/etc all resolve empty, so only the filename-derived rules
// produce output. The builder is awaitable (→ {data: []}) and .maybeSingle() → {data: null}.
vi.mock("@/lib/supabase/admin", () => {
  const builder = () => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.is = () => b;
    b.maybeSingle = async () => ({ data: null });
    b.then = (resolve: (v: { data: unknown[] }) => void) => resolve({ data: [] });
    return b;
  };
  return { createAdminClient: () => ({ from: () => builder() }) };
});

const { autoRouteFile } = await import("../autoRoute");

const ctx = (over: Partial<AutoRouteContext> = {}): AutoRouteContext => ({
  uploaderId: null, // skip Rule 3 (uploader-department fallback)
  companyId: "c1",
  fileName: "file.pdf",
  mimeType: "application/pdf",
  source: "library",
  ...over,
});

describe("autoRouteFile — filename → title (Rule 4)", () => {
  it("strips the extension, normalizes separators, capitalizes the first letter only", async () => {
    const r = await autoRouteFile(ctx({ fileName: "Q3-budget_report.final.xlsx" }));
    expect(r.title).toBe("Q3 budget report final");
  });

  it("capitalizes the first letter and preserves the rest (Q3 stays Q3; note: iPhone → IPhone)", async () => {
    // The code force-uppercases only the first char, so an already-capitalized token like "Q3" is unchanged…
    expect((await autoRouteFile(ctx({ fileName: "Q3 planning.pdf" }))).title).toBe("Q3 planning");
    // …but a lowercase-initial brand token gets its first letter capitalized (IPhone), which the header
    // comment's "iPhone stays iPhone" claim overstates. Cosmetic only — titles are user-editable in the modal.
    expect((await autoRouteFile(ctx({ fileName: "iPhone-screenshot.png" }))).title).toBe("IPhone screenshot");
  });

  it("handles a name with no extension", async () => {
    expect((await autoRouteFile(ctx({ fileName: "README" }))).title).toBe("README");
  });
});

describe("autoRouteFile — filename → tags (Rule 5)", () => {
  it("maps keyword tokens AND the extension to tags", async () => {
    const r = await autoRouteFile(ctx({ fileName: "Q3-budget-report-final.xlsx" }));
    expect(r.tags).toEqual(expect.arrayContaining(["budget", "report", "final", "spreadsheet"]));
  });

  it("adds only the format tag when no keywords match", async () => {
    expect((await autoRouteFile(ctx({ fileName: "misc.pdf" }))).tags).toEqual(["pdf"]);
  });

  it("dedupes tags that arrive from both a keyword and the extension", async () => {
    // "notes" is both a keyword token and the .md/.txt extension tag → appears once
    const r = await autoRouteFile(ctx({ fileName: "notes.md" }));
    expect(r.tags.filter((t) => t === "notes")).toHaveLength(1);
  });
});

describe("autoRouteFile — C.A.R.E routing (Rule 6) + trace", () => {
  it("tags a care_agent upload as customer-support", async () => {
    const r = await autoRouteFile(ctx({ source: "care_agent", fileName: "chat-log.txt" }));
    expect(r.tags).toContain("customer-support");
    expect(r.ruleTrace).toContain("R6:care-tag");
  });

  it("records which rules fired in the trace (auditable per §3.5)", async () => {
    const r = await autoRouteFile(ctx({ fileName: "budget.xlsx" }));
    expect(r.ruleTrace).toContain("R4:title-from-filename");
    expect(r.ruleTrace.some((t) => t.startsWith("R5:"))).toBe(true);
  });

  it("returns empty department/task arrays when nothing links or matches", async () => {
    const r = await autoRouteFile(ctx({ fileName: "loose.pdf" }));
    expect(r.departmentIds).toEqual([]);
    expect(r.taskIds).toEqual([]);
  });
});
