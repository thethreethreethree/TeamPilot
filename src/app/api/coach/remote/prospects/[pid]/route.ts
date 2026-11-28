import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { isTaskClosed } from "@/lib/tasks/statusLabels";
import { eventValue } from "@/lib/coach/remote/macroMode";
import { AccountReadError, contactsOfDeal, DEAL_ROLES } from "@/lib/coach/remote/revenue/accounts";
import { recommendedContacts, type Suggested } from "@/lib/coach/remote/revenue/recommendedContacts";
import { runAgentsForStage, runAgentsForCallLinked, stageChanged } from "@/lib/coach/remote/engage/agents";


// Linking a call runs call-added agents after the reply, which may read the playbook (an AI call): the playbook
// route's time, not the default (review 2026-11-28).
export const maxDuration = 90;
/**
 * /api/coach/remote/prospects/:pid — one prospect in the Remote Sales pipeline (Macro Mode, 0303).
 *   GET  → { prospect, history, calls, todos }
 *   POST { action: "set", kind, value }   — a new fact (stage/amount/next call/name/organization/source/expected close date, 0320) as an EVENT (§3.1)
 *        { action: "link", sessionId }    — this call belongs to this prospect (last call date is derived from links)
 *        { action: "todo", title, due }   — a to-do, created as a Task assigned to the prospect's rep
 *        { action: "account", accountId | name | null } — the deal's account (0370): an existing one the caller can see,
 *                                          or found/made by name (rss_account_find_or_create, the key's one authority), or
 *                                          none; an 'account' EVENT
 *        { action: "contact", contactId, role } — a contact on the deal with a role, or role "removed" (0370 deal_contacts)
 *   GET also returns { account, contacts } (revenue Phase 1).
 * All reads and writes go through the caller's client: a prospect the caller cannot see is a 404 for reads and a
 * refused insert for writes (0303's policies), never a confirmation that it exists.
 */
const Set_ = z.object({
  action: z.literal("set"),
  kind: z.enum(["name", "organization", "stage", "amount", "next_call", "source", "close_date"]),
  value: z.union([z.string().max(120), z.number().min(0).max(1e10), z.null(), z.object({ status: z.enum(["open", "won", "lost"]), label: z.string().max(60).optional() })]),
});
const Link = z.object({ action: z.literal("link"), sessionId: z.string().uuid() });
const Todo = z.object({ action: z.literal("todo"), title: z.string().trim().min(1).max(200), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Account = z.object({
  action: z.literal("account"),
  accountId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});
const Contact = z.object({
  action: z.literal("contact"),
  contactId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  role: z.enum([...DEAL_ROLES, "removed"]),
});
const Body = z.discriminatedUnion("action", [Set_, Link, Todo, Account, Contact]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-prospect-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: p, error } = await db.from("remote_prospects_current").select("*").eq("id", pid).maybeSingle();
  if (error) {
    console.error(`[prospect] read failed id=${pid}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  }
  if (!p) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  const [ev, calls, links] = await Promise.all([
    db.from("remote_prospect_events").select("kind, value, actor_id, created_at").eq("prospect_id", pid).order("id", { ascending: false }).limit(100),
    db.from("remote_prospect_calls").select("session_id, created_at").eq("prospect_id", pid),
    db.from("remote_prospect_tasks").select("task_id").eq("prospect_id", pid),
  ]);
  if (ev.error || calls.error || links.error) return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  const sessionIds = ((calls.data ?? []) as Array<{ session_id: string }>).map((c) => c.session_id);
  const taskIds = ((links.data ?? []) as Array<{ task_id: string }>).map((l) => l.task_id);
  const [sess, tasks] = await Promise.all([
    sessionIds.length
      ? db.from("coaching_sessions").select("id, client_label, context, started_at, outcome").in("id", sessionIds).order("started_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    taskIds.length ? db.from("tasks").select("id, title, status, due_date").in("id", taskIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
  ]);
  // Not "no calls, no to-dos" (2026-11-23): a failed second read would show an empty prospect.
  if (sess.error || tasks.error) {
    console.error(`[prospect] calls/to-dos read failed id=${pid}: ${(sess.error ?? tasks.error)?.message}`);
    return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  }
  // Revenue Phase 1 (0370): the deal's account and contacts. A failed read is a 500, never "no account".
  let account: { id: string; name: string } | null = null;
  let contacts: Awaited<ReturnType<typeof contactsOfDeal>> = [];
  try {
    if (p.account_id) {
      const { data: a, error: aErr } = await db.from("accounts_current").select("id, name").eq("id", p.account_id).maybeSingle();
      if (aErr) throw new AccountReadError(aErr.message);
      if (a) account = { id: String(a.id), name: (a.name as string | null) ?? "(no name)" };
    }
    contacts = await contactsOfDeal(db, pid);
  } catch (e) {
    if (!(e instanceof AccountReadError)) throw e;
    console.error(`[prospect] account/contacts read failed id=${pid}: ${e.message}`);
    return NextResponse.json({ error: "Couldn't load this prospect." }, { status: 500 });
  }
  // Revenue phase 9 (F26.6): the account's people heard on its calls who aren't on this deal. A failed read is said on
  // the Contacts tab (null), never "no one to suggest", and doesn't take the deal down with it.
  let suggested: Suggested[] | null = [];
  if (account) {
    try {
      suggested = await recommendedContacts(db, account.id, new Set(contacts.map((c) => c.id)));
    } catch (e) {
      if (!(e instanceof AccountReadError)) throw e;
      console.error(`[prospect] suggested contacts read failed id=${pid}: ${e.message}`);
      suggested = null;
    }
  }
  // Revenue phase 8 (F23.11): who made each change, for the Activity tab's field history. Names only; a failed read
  // shows "A teammate" rather than hiding the history.
  const actorIds = [...new Set(((ev.data ?? []) as Array<{ actor_id: string | null }>).map((e) => e.actor_id).filter((x): x is string => !!x))];
  const actorsRead = actorIds.length ? await db.from("profiles").select("id, full_name").in("id", actorIds) : { data: [], error: null };
  if (actorsRead.error) console.error(`[prospect] actor names read failed id=${pid}: ${actorsRead.error.message}`);
  const actorRows = (actorsRead.data ?? []) as Array<{ id: string; full_name: string | null }>;
  // The accounts the history names, by name where the caller can see them (accounts_current's RLS); else "an account".
  const accountIds = [...new Set(((ev.data ?? []) as Array<{ kind: string; value: { account_id?: string | null } | null }>).filter((e) => e.kind === "account" && e.value?.account_id).map((e) => String(e.value!.account_id)))];
  const accountsRead = accountIds.length ? await db.from("accounts_current").select("id, name").in("id", accountIds) : { data: [], error: null };
  if (accountsRead.error) console.error(`[prospect] account names read failed id=${pid}: ${accountsRead.error.message}`);
  const accountRows = (accountsRead.data ?? []) as Array<{ id: string; name: string | null }>;
  return NextResponse.json({
    prospect: p,
    account,
    contacts,
    history: ev.data ?? [],
    suggested,
    actors: Object.fromEntries(actorRows.map((a) => [String(a.id), a.full_name || "Unnamed teammate"])),
    accounts: Object.fromEntries(accountRows.map((a) => [String(a.id), a.name || "(no name)"])),
    calls: ((sess.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id), label: s.client_label ?? null, context: s.context, startedAt: s.started_at, outcome: s.outcome ?? null,
    })),
    todos: ((tasks.data ?? []) as Array<{ id: string; title: string; status: string | null; due_date: string | null }>)
      .map((t) => ({ id: String(t.id), title: t.title, due: t.due_date, status: t.status ?? "To Do", done: isTaskClosed(t.status) }))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999")),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-prospect-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: p } = await db.from("remote_prospects").select("id, rep_id, company_id").eq("id", pid).maybeSingle();
  if (!p) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });

  if (body.action === "set") {
    const value = eventValue(body.kind, body.value);
    if (!value) return NextResponse.json({ error: "That value doesn't fit this field." }, { status: 400 });
    // The stage before this save, so agents fire only when the stage actually changes (saving the same stage again,
    // or editing it to itself, isn't "reaching" it).
    const before = body.kind === "stage" ? await db.from("remote_prospects_current").select("status, stage_label").eq("id", pid).maybeSingle() : null;
    const { error } = await db.from("remote_prospect_events").insert({ prospect_id: pid, company_id: p.company_id, kind: body.kind, value, actor_id: ctx.userId });
    if (error) {
      console.error(`[prospect] event failed id=${pid}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save that change." }, { status: 500 });
    }
    // Engage plan E5 (0379): a stage change runs the company's agents whose trigger it fires, after the reply.
    if (body.kind === "stage" && before && !before.error) {
      const v = value as { status?: string; label?: string };
      if (stageChanged(before.data as { status: string; stage_label: string | null } | null, { status: String(v.status ?? "open"), label: v.label ?? null })) after(() => runAgentsForStage(createAdminClient(), { companyId: String(p.company_id), prospectId: pid, status: String(v.status ?? "open"), label: v.label ?? null }));
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "link") {
    const { error } = await db.from("remote_prospect_calls").insert({ prospect_id: pid, session_id: body.sessionId, company_id: p.company_id, linked_by: ctx.userId });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That call already belongs to a prospect." }, { status: 409 });
      // 0304: a call joins only the pipeline of the rep who took it.
      return NextResponse.json({ error: "Only a call this prospect's rep took can be linked to it." }, { status: 403 });
    }
    // Engage plan E12 (0392): agents whose trigger is "a call is added to a deal", after the reply.
    after(() => runAgentsForCallLinked(createAdminClient(), { companyId: String(p.company_id), prospectId: pid, sessionId: body.sessionId }));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "account") {
    let accountId: string | null = body.accountId ?? null;
    if (body.name) {
      const { data: id, error: fErr } = await createAdminClient().rpc("rss_account_find_or_create", { p_company: ctx.companyId, p_actor: ctx.userId, p_name: body.name });
      if (fErr || !id) {
        console.error(`[prospect] account find-or-create failed id=${pid}: ${fErr?.message ?? "no id"}`);
        return NextResponse.json({ error: "Couldn't save that account." }, { status: 500 });
      }
      accountId = String(id);
    } else if (accountId) {
      // An existing account must be one the caller can see; else it's "not found", never a confirmation it exists.
      const { data: seen } = await db.from("accounts").select("id").eq("id", accountId).maybeSingle();
      if (!seen) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    const { error } = await db.from("remote_prospect_events").insert({ prospect_id: pid, company_id: p.company_id, kind: "account", value: { account_id: accountId }, actor_id: ctx.userId });
    if (error) {
      console.error(`[prospect] account event failed id=${pid}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save that account." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, accountId });
  }

  if (body.action === "contact") {
    const { error } = await db.from("deal_contacts").insert({ prospect_id: pid, contact_id: body.contactId, company_id: p.company_id, role: body.role, actor_id: ctx.userId });
    if (error) {
      console.error(`[prospect] contact link failed id=${pid}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save that contact on this deal." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // A to-do is a Task assigned to the prospect's rep, so it shows in Tasks and its reminders work as any task's.
  const admin = createAdminClient();
  const { data: rep } = await admin.from("profiles").select("full_name").eq("company_id", p.company_id).eq("id", p.rep_id).maybeSingle();
  const { data: name } = await db.from("remote_prospects_current").select("name").eq("id", pid).maybeSingle();
  const { data: task, error } = await db
    .from("tasks")
    .insert({
      company_id: p.company_id,
      title: body.title,
      description: `Pipeline to-do for ${name?.name ?? "a prospect"}.\nProspect: /dashboard/remote-sales/pipeline?p=${pid}`,
      status: "To Do",
      priority: "Medium",
      due_date: body.due,
      assignee: (rep?.full_name as string | null) ?? null,
      assignee_user_id: p.rep_id,
    })
    .select("id")
    .single();
  if (error || !task) {
    console.error(`[prospect] to-do failed id=${pid}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add the to-do." }, { status: 500 });
  }
  const { error: lErr } = await db.from("remote_prospect_tasks").insert({ prospect_id: pid, task_id: task.id, company_id: p.company_id, created_by: ctx.userId });
  if (lErr) {
    // Said, not swallowed: the task exists but is not on this prospect, so the pipeline would not show it.
    console.error(`[prospect] to-do link failed id=${pid}: ${lErr.message}`);
    return NextResponse.json({ error: "The task was created but couldn't be attached to this prospect.", taskId: String(task.id) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, taskId: String(task.id) });
}
