import { describe, it, expect, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * `listFiles` — where the m2m filter runs, and what an empty answer means.
 *
 * TWO DEFECTS, both silent, both fixed 2026-09-22:
 *
 *   1. The department/task/tag filters ran in JavaScript AFTER `.limit(200)`, so `?task=<id>` meant
 *      "of the newest 200 files in the tenant, the ones on this task". A task whose assets are
 *      older than that window renders as *No files attached yet* — and `TaskAssetsSection` issues
 *      exactly that request on every task detail view.
 *
 *   2. `if (error) return []` turned a failed read into an empty library, which made the library
 *      page's own "Couldn't load your files" branch unreachable: the route answered 200, so
 *      `res.ok` was true and the page fell through to "No assets yet".
 *
 * Neither is visible from the outside. Both produce a plausible screen.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listFiles } from "../files";

const fileRow = (id: string) => ({
  id,
  title: `File ${id}`,
  description: null,
  storage_path: `p/${id}`,
  mime_type: "application/pdf",
  size_bytes: 10,
  uploader_id: "u1",
  classification_lane: "classified",
  created_at: "2026-01-01T00:00:00Z",
  deprecated_at: null,
});

/** `[method, args]` pairs, in the order the client issued them. */
type Calls = Array<[string, unknown[]]>;

function mock(byTable: Record<string, unknown>, calls: Calls) {
  vi.mocked(createClient).mockResolvedValue(makeSupabaseClient(byTable, calls) as never);
}

/** Which tables were asked for, in order. */
const tablesAsked = (calls: Calls) =>
  calls.filter(([m]) => m === "from").map(([, a]) => a[0] as string);

/**
 * Calls issued ON A GIVEN TABLE.
 *
 * Scoped by table rather than globally, because `fetchUploaderNames` and `fetchJoinRows` issue
 * their own filters against other tables — a global matcher made one case pass for the wrong
 * reason on the first run of this file.
 */
function callsOn(calls: Calls, table: string, method: string): unknown[][] {
  const out: unknown[][] = [];
  let current: string | null = null;
  for (const [m, args] of calls) {
    if (m === "from") current = args[0] as string;
    else if (m === method && current === table) out.push(args);
  }
  return out;
}

/** The select string the files query was built with. */
const filesSelect = (calls: Calls) => String(callsOn(calls, "files", "select")[0]?.[0] ?? "");

describe("a task filter is applied in the database, not after the cut", () => {
  it("inner-joins the join table in the files query itself", async () => {
    // THE DEFECT THIS PINS. `!inner` is what makes `.limit()` apply to the FILTERED set. Drop it
    // and the filter is back behind a LIMIT, where an older task silently reports no files.
    const calls: Calls = [];
    mock({ files: { data: [fileRow("f1")], error: null } }, calls);

    const out = await listFiles({ taskId: "t1" });

    expect(filesSelect(calls)).toContain("file_tasks!inner(task_id)");
    expect(callsOn(calls, "files", "eq")).toContainEqual(["file_tasks.task_id", "t1"]);
    expect(out?.map((f) => f.id)).toEqual(["f1"]);
  });

  it("does it in ONE request — no separate pre-read of the join table", async () => {
    // An earlier draft read the join table first and passed ids back as `.in("id", […])`. That
    // was correct and needed a cap on the id list, and a cap is the same defect one layer along:
    // a department with more files than the cap would silently get an arbitrary subset.
    const calls: Calls = [];
    mock({ files: { data: [fileRow("f1")], error: null } }, calls);

    await listFiles({ taskId: "t1" });

    // `file_tasks` is still read afterwards, by fetchJoinRows, to hydrate each row's taskIds —
    // but the FIRST table touched must be `files`, i.e. the filter travelled with the query.
    expect(tablesAsked(calls)[0]).toBe("files");
  });

  it("composes several filters as an AND", async () => {
    const calls: Calls = [];
    mock({ files: { data: [fileRow("f2")], error: null } }, calls);

    await listFiles({ departmentId: "d1", taskId: "t1", tag: "pricing" });

    const select = filesSelect(calls);
    expect(select).toContain("file_departments!inner(department_id)");
    expect(select).toContain("file_tasks!inner(task_id)");
    expect(select).toContain("file_tags!inner(tag)");
    const eqs = callsOn(calls, "files", "eq");
    expect(eqs).toContainEqual(["file_departments.department_id", "d1"]);
    expect(eqs).toContainEqual(["file_tasks.task_id", "t1"]);
    expect(eqs).toContainEqual(["file_tags.tag", "pricing"]);
  });

  it("adds no join at all when no m2m filter was asked for", async () => {
    // An unconditional `!inner` would quietly drop every file that has no department.
    const calls: Calls = [];
    mock({ files: { data: [fileRow("f1")], error: null } }, calls);

    const out = await listFiles({});
    expect(filesSelect(calls)).not.toContain("!inner");
    expect(out?.map((f) => f.id)).toEqual(["f1"]);
  });
});

describe("a failed read is not an empty library", () => {
  it("returns null when the files query fails", async () => {
    // `[]` here is what made the library page's error branch unreachable.
    mock({ files: { data: null, error: { message: "boom" } } }, []);
    expect(await listFiles({})).toBeNull();
  });

  it("returns [] for a successful read that matched nothing", async () => {
    // The distinction only works if BOTH halves hold. Null must never mean "nothing matched".
    mock({ files: { data: [], error: null } }, []);
    expect(await listFiles({})).toEqual([]);
  });

  it("returns [] — not null — when a filter genuinely matches no files", async () => {
    // The inner join returning no rows is a successful read of nothing, and the panel should say
    // "no files attached", not "couldn't load".
    mock({ files: { data: [], error: null } }, []);
    expect(await listFiles({ taskId: "t-with-nothing" })).toEqual([]);
  });
});
