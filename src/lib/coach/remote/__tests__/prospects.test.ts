import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { listProspects } from "../prospects";

/**
 * The pipeline list (0303). A to-do is a Task; Tasks are soft-deleted (deleted_at). A to-do deleted on the Tasks
 * board must not keep showing as the prospect's open "To do" — and a failed read is null, never an empty pipeline.
 */
function db(opts: { prospects: unknown[]; links: unknown[]; tasks: unknown[]; fail?: "prospects" | "tasks" }) {
  const seen: Record<string, Array<[string, ...unknown[]]>> = {};
  const from = (table: string) => {
    const calls: Array<[string, ...unknown[]]> = (seen[table] = []);
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "eq", "in", "is"]) q[m] = (...a: unknown[]) => (calls.push([m, ...a]), q);
    (q as { then: unknown }).then = (res: (v: unknown) => unknown) => {
      if (opts.fail === table || (opts.fail === "prospects" && table === "remote_prospects_current")) return Promise.resolve(res({ data: null, error: { message: "boom" } }));
      const data = table === "remote_prospects_current" ? opts.prospects : table === "remote_prospect_tasks" ? opts.links : opts.tasks;
      return Promise.resolve(res({ data, error: null }));
    };
    // Paged reads (2026-11-26: the prospect list is paged, no longer capped at 500): one page, then empty.
    q.range = (fromRow: number, ...rest: unknown[]) => {
      calls.push(["range", fromRow, ...rest]);
      if (fromRow > 0) return Promise.resolve({ data: [], error: null });
      return { then: (q as { then: (r: (v: unknown) => unknown) => unknown }).then } as unknown;
    };
    return q;
  };
  return { client: { from } as never, seen };
}

const P = { id: "p1", rep_id: "r1", name: "Betty", organization: null, status: "open", stage_label: null, amount: "1500", next_call_date: null, last_call_at: null, call_count: 1, created_at: "2026-11-22T00:00:00Z" };

describe("listProspects", () => {
  it("reads to-dos without soft-deleted tasks, and picks the earliest open one as next", async () => {
    const { client, seen } = db({
      prospects: [P],
      links: [{ prospect_id: "p1", task_id: "t1" }, { prospect_id: "p1", task_id: "t2" }, { prospect_id: "p1", task_id: "t3" }],
      tasks: [
        { id: "t1", title: "Send quote", status: "To Do", due_date: "2026-11-26" },
        { id: "t2", title: "Call back", status: "In Progress", due_date: "2026-11-24" },
        { id: "t3", title: "Old one", status: "Completed", due_date: "2026-11-01" },
      ],
    });
    const rows = (await listProspects(client))!;
    expect(seen.tasks).toContainEqual(["is", "deleted_at", null]);
    expect(rows[0]!.openTodos).toBe(2);
    expect(rows[0]!.nextTodo).toEqual({ id: "t2", title: "Call back", due: "2026-11-24" });
    expect(rows[0]!.amount).toBe(1500);
  });

  it("reads every prospect, paged by a unique order — no 500 cap (2026-11-26)", async () => {
    const many = Array.from({ length: 600 }, (_, i) => ({ ...P, id: `p${i}` }));
    const { client, seen } = db({ prospects: many, links: [], tasks: [] });
    const rows = (await listProspects(client))!;
    expect(rows).toHaveLength(600);
    expect(seen.remote_prospects_current!.some(([m]) => m === "limit")).toBe(false);
    expect(seen.remote_prospects_current).toContainEqual(["order", "id", { ascending: false }]);
    expect(seen.remote_prospects_current!.some(([m]) => m === "range")).toBe(true);
  });

  it("a failed read is null, never an empty pipeline", async () => {
    expect(await listProspects(db({ prospects: [], links: [], tasks: [], fail: "prospects" }).client)).toBeNull();
    expect(await listProspects(db({ prospects: [P], links: [{ prospect_id: "p1", task_id: "t1" }], tasks: [], fail: "tasks" }).client)).toBeNull();
  });
});
