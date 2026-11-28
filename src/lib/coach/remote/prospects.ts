import "server-only";
import { readDealSentiment, type DealSentiment } from "./dealSentiment";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTaskClosed } from "@/lib/tasks/statusLabels";
import { rankOf, type Rank } from "./revenue/rank";
import { replayNotes, type Element, type NoteEvent, type NoteState } from "./revenue/playbook";

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
  /** Revenue phase 10 (0394): the deal's split between owners; absent or null = the rep's whole deal. */
  split?: Array<{ userId: string; pct: number }> | null;
  /** Revenue Phase 1–2 (0370): the deal's account and how many contacts are on it. */
  accountId?: string | null;
  accountName?: string | null;
  contacts?: number;
  /** Revenue Phase 3a (0372 rss_deal_signals): the facts behind Gong's warnings, for dealRisk. Open deals only. */
  signals?: { lastTwoWayAt: string | null; pricingMentioned: boolean; stageEnteredAt: string | null; contacts: Array<{ rank: Rank; lastOnCall: string | null }> };
  /** Revenue Phase 4 (0375): when the deal last became won or lost; null while open or if never set. */
  closedAt?: string | null;
  /** The company's limit for this deal's stage (0372 stall_days), when it has one. */
  stallDays?: number | null;
  /** Revenue Phase 3b (0373): each playbook element's letter and its note's state on this deal. */
  playbook?: Array<{ letter: string; name: string; state: NoteState }>;
};

type CurrentRow = {
  id: string; rep_id: string; name: string | null; organization: string | null; status: string; stage_label: string | null;
  amount: number | string | null; next_call_date: string | null; last_call_at: string | null; call_count: number | string; created_at: string;
  source?: string | null;
  close_date?: string | null;
  next_call_time?: string | null;
  account_id?: string | null;
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

/**
 * The prospects the caller may see, optionally one rep's. Null on a failed read (never an empty pipeline).
 *
 * `companyId` (2026-11-27) is for a service-role caller (a scheduled job): RLS doesn't apply there, so every table read
 * below is pinned to that company. The reads keyed only by deal ids (signals, sentiment) are pinned through those ids,
 * which all come from the pinned deal list. A user's client never passes it; RLS is its boundary.
 */
export async function listProspects(db: SupabaseClient, repId?: string, opts: { sentiment?: boolean; companyId?: string; ids?: string[] } = {}): Promise<ProspectRow[] | null> {
  // ids (0395): only these deals (a co-owner's, up to 150 — read pinned to the company by the caller).
  if (opts.ids && opts.ids.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pin = <Q,>(q: Q): Q => (opts.companyId ? ((q as any).eq("company_id", opts.companyId) as Q) : q);
  // Every prospect, paged (2026-11-26): the read stopped at 500, so a pipeline past 500 deals lost its oldest without a
  // word — and every page, total, forecast and win rate built on it with them. Ordered by a unique key last.
  const { data, error } = await fetchAllPagedResult<CurrentRow>(
    (from, to) => {
      let q = pin(db
        .from("remote_prospects_current")
        .select("id, rep_id, name, organization, status, stage_label, amount, next_call_date, last_call_at, call_count, created_at, source, close_date, next_call_time, account_id"))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (repId) q = q.eq("rep_id", repId);
      if (opts.ids) q = q.in("id", opts.ids.slice(0, 150));
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
    // Paged too (review 2026-11-26): 150 deals with many to-dos each can pass the 1000-row reply cap.
    const { data: links, error: lErr } = await fetchAllPagedResult<{ prospect_id: string; task_id: string; id: number }>(
      (from, to) => pin(db.from("remote_prospect_tasks").select("prospect_id, task_id, id")).in("prospect_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "prospect to-do links", maxRows: 200_000 },
    );
    if (lErr) {
      console.error(`[prospects] to-do links failed: ${lErr.message}`);
      return null;
    }
    linkRows.push(...(links ?? []));
  }
  const tasks: TaskRow[] = [];
  const taskIds = linkRows.map((l) => l.task_id);
  for (let i = 0; i < taskIds.length; i += 150) {
    // A task deleted on the Tasks board is soft-deleted (deleted_at): it is not an open to-do any more.
    const { data: t, error: tErr } = await pin(db.from("tasks").select("id, title, status, due_date")).in("id", taskIds.slice(i, i + 150)).is("deleted_at", null);
    if (tErr) {
      console.error(`[prospects] to-dos failed: ${tErr.message}`);
      return null;
    }
    tasks.push(...((t ?? []) as TaskRow[]));
  }
  const byId = new Map(tasks.map((t) => [String(t.id), t]));
  const tasksOf = new Map<string, TaskRow[]>();
  for (const l of linkRows) {
    const t = byId.get(String(l.task_id));
    if (t) tasksOf.set(String(l.prospect_id), [...(tasksOf.get(String(l.prospect_id)) ?? []), t]);
  }
  // Deal sentiment (2026-11-23, dealSentiment.ts) — only for callers that show it; a failed read fails the whole list.
  let sentiment: Map<string, DealSentiment> | null = new Map();
  if (opts.sentiment) {
    sentiment = await readDealSentiment(db, rows.map((r) => String(r.id)));
    if (sentiment === null) {
      console.error("[prospects] deal sentiment read failed");
      return null;
    }
  }
  // Accounts and contact counts (0370), in chunks; a failed read fails the list (never "no account").
  const accountIds = [...new Set(rows.map((r) => r.account_id).filter((x): x is string => !!x))];
  const accountName = new Map<string, string>();
  for (let i = 0; i < accountIds.length; i += 150) {
    const { data: a, error: aErr } = await pin(db.from("accounts_current").select("id, name")).in("id", accountIds.slice(i, i + 150));
    if (aErr) {
      console.error(`[prospects] accounts failed: ${aErr.message}`);
      return null;
    }
    for (const x of (a ?? []) as Array<{ id: string; name: string | null }>) accountName.set(String(x.id), x.name ?? "(no name)");
  }
  const contactCount = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data: dc, error: dErr } = await fetchAllPagedResult<{ prospect_id: string; contact_id: string }>(
      (from, to) => pin(db.from("deal_contacts_current").select("prospect_id, contact_id")).in("prospect_id", ids.slice(i, i + 150)).neq("role", "removed").order("prospect_id").order("contact_id").range(from, to),
      { label: "deal contacts", maxRows: 200_000 },
    );
    if (dErr) {
      console.error(`[prospects] deal contacts failed: ${dErr.message}`);
      return null;
    }
    for (const x of dc ?? []) contactCount.set(String(x.prospect_id), (contactCount.get(String(x.prospect_id)) ?? 0) + 1);
  }
  // Revenue Phase 3a (0372) / 4 (0375): the facts behind Gong's warnings (used for open deals) and win/loss (contacts'
  // ranks, when a deal closed — used for closed ones), as the caller (RLS applies), for every deal. A failed read fails
  // the list: a deal shown with no warnings because its facts didn't load would read as healthy.
  type SignalRow = { prospect_id: string; last_two_way_at: string | null; pricing_mentioned: boolean; stage_entered_at: string | null; contacts: Array<{ title: string | null; last_on_call: string | null }> | null; closed_at?: string | null };
  const signals = new Map<string, NonNullable<ProspectRow["signals"]>>();
  const closedAt = new Map<string, string | null>();
  const openIds = rows.map((r) => String(r.id));
  for (let i = 0; i < openIds.length; i += 150) {
    const { data: sg, error: sErr } = await db.rpc("rss_deal_signals", { p_ids: openIds.slice(i, i + 150) });
    if (sErr) {
      console.error(`[prospects] deal signals failed: ${sErr.message}`);
      return null;
    }
    for (const x of (sg ?? []) as SignalRow[]) {
      signals.set(String(x.prospect_id), {
        lastTwoWayAt: x.last_two_way_at,
        pricingMentioned: !!x.pricing_mentioned,
        stageEnteredAt: x.stage_entered_at,
        contacts: (x.contacts ?? []).map((c) => ({ rank: rankOf(c.title), lastOnCall: c.last_on_call })),
      });
      closedAt.set(String(x.prospect_id), x.closed_at ?? null);
    }
  }
  // Each stage's own limit (0372 stall_days) from the company's list; a stage with none never stalls.
  const stall = new Map<string, number>();
  {
    const { data: list, error: lErr } = await pin(db.from("deal_stage_list_current").select("stages")).maybeSingle();
    if (lErr) {
      console.error(`[prospects] stage list failed: ${lErr.message}`);
      return null;
    }
    for (const st of ((list?.stages ?? []) as Array<{ name: string; stall_days?: number | null }>)) {
      if (st.stall_days) stall.set(st.name.trim().toLowerCase(), st.stall_days);
    }
  }
  // Revenue Phase 3b (0373): the company's playbook and each deal's note states (the replay is the rule, playbook.ts).
  const playbookOf = new Map<string, Array<{ letter: string; name: string; state: NoteState }>>();
  {
    const { data: pb, error: pbErr } = await pin(db.from("deal_playbook_current").select("id, elements")).maybeSingle();
    if (pbErr) {
      console.error(`[prospects] playbook failed: ${pbErr.message}`);
      return null;
    }
    if (pb) {
      const elements = pb.elements as Element[];
      const evs = new Map<string, NoteEvent[]>();
      for (let i = 0; i < ids.length; i += 150) {
        const { data: ns, error: nErr } = await fetchAllPagedResult<{ id: number; prospect_id: string; element: number; action: NoteEvent["action"]; actor_id: string; created_at: string }>(
          (from, to) => pin(db.from("deal_element_notes").select("id, prospect_id, element, action, actor_id, created_at")).eq("playbook_id", pb.id).in("prospect_id", ids.slice(i, i + 150)).order("id").range(from, to),
          { label: "deal notes", maxRows: 200_000 },
        );
        if (nErr) {
          console.error(`[prospects] deal notes failed: ${nErr.message}`);
          return null;
        }
        // Only the actions matter for the state (text isn't read here); a stand-in note lets 'write' replay.
        for (const n of ns ?? []) evs.set(String(n.prospect_id), [...(evs.get(String(n.prospect_id)) ?? []), { element: n.element, action: n.action, note: n.action === "write" ? "·" : null, ai: null, actorId: n.actor_id, at: n.created_at }]);
      }
      for (const id of ids) {
        const views = replayNotes(evs.get(String(id)) ?? [], elements.length);
        playbookOf.set(String(id), elements.map((e, k) => ({ letter: e.letter, name: e.name, state: views[k]!.state })));
      }
    }
  }
  // OFFSET paging can hand back a row twice when a deal changes mid-read; each deal appears once.
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(String(r.id)) ? false : (seen.add(String(r.id)), true)));
  return unique.map((r) => ({
    ...toRow(r, tasksOf.get(String(r.id)) ?? []),
    sentiment: sentiment!.get(String(r.id)) ?? null,
    accountId: r.account_id ?? null,
    accountName: r.account_id ? accountName.get(String(r.account_id)) ?? null : null,
    contacts: contactCount.get(String(r.id)) ?? 0,
    signals: signals.get(String(r.id)),
    stallDays: r.stage_label ? stall.get(r.stage_label.trim().toLowerCase()) ?? null : null,
    playbook: playbookOf.get(String(r.id)),
    closedAt: closedAt.get(String(r.id)) ?? null,
  }));
}
