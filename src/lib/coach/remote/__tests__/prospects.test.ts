import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { listProspects } from "../prospects";

/**
 * The pipeline list (0303). A to-do is a Task; Tasks are soft-deleted (deleted_at). A to-do deleted on the Tasks
 * board must not keep showing as the prospect's open "To do" — and a failed read is null, never an empty pipeline.
 */
function db(opts: { prospects: unknown[]; links: unknown[]; tasks: unknown[]; accounts?: unknown[]; dealContacts?: unknown[]; signals?: unknown[]; stageList?: unknown; fail?: "prospects" | "tasks" | "accounts_current" | "deal_contacts_current" | "signals" }) {
  const seen: Record<string, Array<[string, ...unknown[]]>> = {};
  const from = (table: string) => {
    const calls: Array<[string, ...unknown[]]> = (seen[table] = []);
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "eq", "in", "is", "neq"]) q[m] = (...a: unknown[]) => (calls.push([m, ...a]), q);
    (q as { then: unknown }).then = (res: (v: unknown) => unknown) => {
      if (opts.fail === table || (opts.fail === "prospects" && table === "remote_prospects_current")) return Promise.resolve(res({ data: null, error: { message: "boom" } }));
      const data =
        table === "remote_prospects_current" ? opts.prospects
        : table === "remote_prospect_tasks" ? opts.links
        : table === "accounts_current" ? (opts.accounts ?? [])
        : table === "deal_contacts_current" ? (opts.dealContacts ?? [])
        : opts.tasks;
      return Promise.resolve(res({ data, error: null }));
    };
    q.maybeSingle = async () => (table === "deal_stage_list_current" ? { data: opts.stageList ?? null, error: null } : { data: null, error: null });
    // Paged reads (2026-11-26: the prospect list is paged, no longer capped at 500): one page, then empty.
    q.range = (fromRow: number, ...rest: unknown[]) => {
      calls.push(["range", fromRow, ...rest]);
      if (fromRow > 0) return Promise.resolve({ data: [], error: null });
      return { then: (q as { then: (r: (v: unknown) => unknown) => unknown }).then } as unknown;
    };
    return q;
  };
  const rpc = async (fn: string, args: { p_ids: string[] }) => {
    (seen[`rpc:${fn}`] ??= []).push(["rpc", args]);
    if (opts.fail === "signals") return { data: null, error: { message: "boom" } };
    return { data: (opts.signals ?? []).filter((x) => args.p_ids.includes((x as { prospect_id: string }).prospect_id)), error: null };
  };
  return { client: { from, rpc } as never, seen };
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

  it("carries each deal's account name and contact count (0370); a failed account or contact read fails the list", async () => {
    const withAcc = { ...P, account_id: "a1" };
    const { client } = db({ prospects: [withAcc], links: [], tasks: [], accounts: [{ id: "a1", name: "Acme" }], dealContacts: [{ prospect_id: "p1", contact_id: "c1" }, { prospect_id: "p1", contact_id: "c2" }] });
    const rows = (await listProspects(client))!;
    expect(rows[0]).toMatchObject({ accountId: "a1", accountName: "Acme", contacts: 2 });
    expect(await listProspects(db({ prospects: [withAcc], links: [], tasks: [], fail: "accounts_current" }).client)).toBeNull();
    expect(await listProspects(db({ prospects: [withAcc], links: [], tasks: [], fail: "deal_contacts_current" }).client)).toBeNull();
  });

  it("carries Gong's warning facts and each stage's limit (0372); a failed signal read fails the list", async () => {
    const won = { ...P, id: "p2", status: "won" };
    const staged = { ...P, stage_label: "Demo" };
    const { client, seen } = db({
      prospects: [staged, won], links: [], tasks: [],
      signals: [{ prospect_id: "p1", last_two_way_at: "2026-11-20T00:00:00Z", pricing_mentioned: true, stage_entered_at: "2026-11-10T00:00:00Z", contacts: [{ title: "VP Sales", last_on_call: null }] }],
      stageList: { stages: [{ name: "demo", kind: "open", stall_days: 7 }] },
    });
    const rows = (await listProspects(client))!;
    expect(seen["rpc:rss_deal_signals"]).toEqual([["rpc", { p_ids: ["p1", "p2"] }]]); // every deal (0375: closed ones for win/loss)
    expect(rows[0]).toMatchObject({ stallDays: 7, signals: { pricingMentioned: true, contacts: [{ rank: "vp", lastOnCall: null }] } });
    expect(rows[1]!.signals).toBeUndefined(); // no signal row came back for it
    expect(await listProspects(db({ prospects: [P], links: [], tasks: [], fail: "signals" }).client)).toBeNull();
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
