import "server-only";
import { readDealSentiment, type DealSentiment } from "./dealSentiment";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTaskClosed } from "@/lib/tasks/statusLabels";

/**
 * Remote Sales pipeline reads (0303). Every read goes through the CALLER's client, so remote_prospects' RLS decides
 * who sees what (the rep's own; a manager's reports under the tree). State comes from remote_prospects_current,
 * which replays each prospect's events (§3.1) — nothing here stores or recomputes a current value.
 * "Is this to-do done" is the Tasks module's own verdict (isTaskClosed), not a second copy of its statuses (§2.2).
 */
export type ProspectRow = {
  id: string;
  repId: string;
  name: string | null;
  organization: string | null;
  status: "open" | "won" | "lost";
  stageLabel: string | null;
  /** The customer's sentiment across this prospect's calls (dealSentiment.ts); null when not read or no reading. */
  sentiment?: DealSentiment | null;
  /** Where the prospect came from (0313), e.g. "Webinar". */
  source: string | null;
  amount: number | null;
  nextCallDate: string | null;
  /** The next call's local time (0325), "HH:MM", when the rep gave one. */
  nextCallTime: string | null;
  /** When the rep expects the deal to close (0320), YYYY-MM-DD. */
  closeDate: string | null;
  lastCallAt: string | null;
  callCount: number;
  createdAt: string;
  openTodos: number;
  nextTodo: { id: string; title: string; due: string | null } | null;
};

type CurrentRow = {
  id: string; rep_id: string; name: string | null; organization: string | null; status: string; stage_label: string | null;
  amount: number | string | null; next_call_date: string | null; last_call_at: string | null; call_count: number | string; created_at: string;
  source?: string | null;
  close_date?: string | null;
  next_call_time?: string | null;
};
type TaskRow = { id: string; title: string; status: string | null; due_date: string | null };

function toRow(r: CurrentRow, todos: TaskRow[]): ProspectRow {
  const open = todos.filter((t) => !isTaskClosed(t.status)).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const amount = r.amount === null || r.amount === undefined ? null : Number(r.amount);
  return {
    id: String(r.id),
    repId: String(r.rep_id),
    name: r.name,
    organization: r.organization,
    status: r.status === "won" || r.status === "lost" ? r.status : "open",
    stageLabel: r.stage_label,
    source: r.source ?? null,
    amount: Number.isFinite(amount) ? amount : null,
    nextCallDate: r.next_call_date,
    closeDate: r.close_date ?? null,
    nextCallTime: r.next_call_time ?? null,
    lastCallAt: r.last_call_at,
    callCount: Number(r.call_count) || 0,
    createdAt: r.created_at,
    openTodos: open.length,
    nextTodo: open[0] ? { id: String(open[0].id), title: open[0].title, due: open[0].due_date } : null,
  };
}

/** The prospects the caller may see, optionally one rep's. Null on a failed read (never an empty pipeline). */
export async function listProspects(db: SupabaseClient, repId?: string, opts: { sentiment?: boolean } = {}): Promise<ProspectRow[] | null> {
  // Every prospect, paged (2026-11-26): the read stopped at 500, so a pipeline past 500 deals lost its oldest without a
  // word — and every page, total, forecast and win rate built on it with them. Ordered by a unique key last.
  const { data, error } = await fetchAllPagedResult<CurrentRow>(
    (from, to) => {
      let q = db
        .from("remote_prospects_current")
        .select("id, rep_id, name, organization, status, stage_label, amount, next_call_date, last_call_at, call_count, created_at, source, close_date, next_call_time")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (repId) q = q.eq("rep_id", repId);
      return q.range(from, to);
    },
    { label: "prospects", maxRows: 50_000 },
  );
  if (error) {
    console.error(`[prospects] list failed: ${error.message}`);
    return null;
  }
  const rows = (data ?? []) as CurrentRow[];
  if (!rows.length) return [];
  // In chunks of 150 ids, so a large pipeline never builds a request URL the API refuses.
  const linkRows: Array<{ prospect_id: string; task_id: string }> = [];
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: links, error: lErr } = await db.from("remote_prospect_tasks").select("prospect_id, task_id").in("prospect_id", ids.slice(i, i + 150));
    if (lErr) {
      console.error(`[prospects] to-do links failed: ${lErr.message}`);
      return null;
    }
    linkRows.push(...((links ?? []) as Array<{ prospect_id: string; task_id: string }>));
  }
  const tasks: TaskRow[] = [];
  const taskIds = linkRows.map((l) => l.task_id);
  for (let i = 0; i < taskIds.length; i += 150) {
    // A task deleted on the Tasks board is soft-deleted (deleted_at): it is not an open to-do any more.
    const { data: t, error: tErr } = await db.from("tasks").select("id, title, status, due_date").in("id", taskIds.slice(i, i + 150)).is("deleted_at", null);
    if (tErr) {
      console.error(`[prospects] to-dos failed: ${tErr.message}`);
      return null;
    }
    tasks.push(...((t ?? []) as TaskRow[]));
  }
  const byId = new Map(tasks.map((t) => [String(t.id), t]));
  // Deal sentiment (2026-11-23, dealSentiment.ts) — only for callers that show it; a failed read fails the whole list.
  let sentiment: Map<string, DealSentiment> | null = new Map();
  if (opts.sentiment) {
    sentiment = await readDealSentiment(db, rows.map((r) => String(r.id)));
    if (sentiment === null) {
      console.error("[prospects] deal sentiment read failed");
      return null;
    }
  }
  return rows.map((r) => ({
    ...toRow(
      r,
      linkRows.filter((l) => l.prospect_id === r.id).flatMap((l) => (byId.has(String(l.task_id)) ? [byId.get(String(l.task_id))!] : [])),
    ),
    sentiment: sentiment!.get(String(r.id)) ?? null,
  }));
}
