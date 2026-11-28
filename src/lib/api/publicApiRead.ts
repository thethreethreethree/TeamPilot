import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hiddenInCompanyFrom } from "@/lib/coach/remote/hidePhrases";
import { isAdminRole } from "@/lib/roles";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { teamCallStats, type StatRow } from "@/lib/coach/remote/teamStats";
import { rubricByVersion } from "@/lib/coach/pitchScore/rubricRegistry";
import { authenticateApiKey, OUTSIDE_READER, paging, recordApiUsage } from "./publicApi";

/**
 * The read endpoints of /api/v1 (Engage plan E3; Gong F31.1–F31.3; the audit log F31.5), one handler. Every statement pins the key's
 * company (the service role bypasses RLS, so this filter is the tenant boundary), lists are ordered by a unique key
 * last, and calls with an active hide are left out (OUTSIDE_READER). No transcripts leave through this API.
 */
export type Resource = "deals" | "accounts" | "contacts" | "calls" | "audit" | "users" | "stats" | "scores" | "todos" | "library" | "flows";

export async function readResource(req: Request, resource: Resource): Promise<NextResponse> {
  const route = `/api/v1/${resource}`;
  const caller = await authenticateApiKey(req, "read", route);
  if (caller instanceof NextResponse) return caller;
  const url = new URL(req.url);
  const { from, to, limit, page } = paging(url);
  const admin = createAdminClient();
  const done = async (body: Record<string, unknown>, status = 200) => {
    await recordApiUsage(caller, route, status);
    return NextResponse.json(body, { status });
  };
  if (resource === "deals") {
    const { data, error } = await admin
      .from("remote_prospects_current")
      .select("id, rep_id, name, status, stage_label, amount, close_date, next_call_date, last_call_at, account_id, created_at")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) return done({ error: "Couldn't read deals." }, 500);
    return done({ data: (data ?? []).map((d) => ({ id: d.id, name: d.name, status: d.status, stage: d.stage_label, amount: d.amount, closeDate: d.close_date, nextCallDate: d.next_call_date, lastCallAt: d.last_call_at, accountId: d.account_id, repId: d.rep_id, createdAt: d.created_at })), page, limit });
  }
  if (resource === "accounts") {
    const { data, error } = await admin.from("accounts_current").select("id, name, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read accounts." }, 500);
    return done({ data: (data ?? []).map((a) => ({ id: a.id, name: a.name, createdAt: a.created_at })), page, limit });
  }
  if (resource === "contacts") {
    const { data, error } = await admin.from("contacts_current").select("id, name, title, account_id, email, phone, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read contacts." }, 500);
    return done({ data: (data ?? []).map((c) => ({ id: c.id, name: c.name, title: c.title, accountId: c.account_id, email: c.email, phone: c.phone, createdAt: c.created_at })), page, limit });
  }
  if (resource === "users") {
    // The company's people (Engage plan E7; Gong F31.2): who they are in EloState, not how to reach them (no email here).
    const { data, error } = await admin.from("profiles").select("id, full_name, role, sales_coach_role, status, manager_id, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read people." }, 500);
    return done({ data: (data ?? []).map((u) => ({ id: u.id, name: u.full_name, role: u.role, salesCoachRole: u.sales_coach_role, status: u.status, managerId: u.manager_id, createdAt: u.created_at })), page, limit });
  }
  if (resource === "stats") {
    // Per rep and team: calls and the interaction stats over 7 / 30 / 90 days (Engage plan E7; Gong F31.2) — the same
    // averages as the app's Team stats (teamCallStats, one rule), phone and video calls only, a call with an active hide
    // left out (OUTSIDE_READER), as everywhere in this API.
    const days = Number(url.searchParams.get("days") ?? 30);
    if (![7, 30, 90].includes(days)) return done({ error: "`days` is 7, 30 or 90." }, 400);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let hiddenS: Set<string>;
    try {
      hiddenS = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
    } catch {
      return done({ error: "Couldn't read stats." }, 500);
    }
    type R = { id: number; session_id: string; rep_id: string; transcript_version: number; talk_ratio_time: number | null; longest_rep_monologue_ms: number | null; longest_customer_story_ms: number | null; interactivity: number | null; patience_ms: number | null; rep_questions_per_hour: number | null };
    const { data, error } = await fetchAllPagedResult<R>(
      (f, t) =>
        admin
          .from("session_interaction_stats")
          .select("id, session_id, rep_id, transcript_version, talk_ratio_time, longest_rep_monologue_ms, longest_customer_story_ms, interactivity, patience_ms, rep_questions_per_hour, coaching_sessions!inner(started_at, context)")
          .eq("company_id", caller.companyId)
          .gte("coaching_sessions.started_at", since)
          .in("coaching_sessions.context", ["phone", "video"])
          .order("id", { ascending: true })
          .range(f, t),
      { label: "api stats", maxRows: 50_000 },
    );
    if (error) return done({ error: "Couldn't read stats." }, 500);
    const { data: people, error: pErr } = await fetchAllPagedResult<{ id: string; full_name: string | null }>(
      (f, t) => admin.from("profiles").select("id, full_name").eq("company_id", caller.companyId).order("id", { ascending: true }).range(f, t),
      { label: "api stats names", maxRows: 20_000 },
    );
    if (pErr) return done({ error: "Couldn't read stats." }, 500);
    const names = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name ?? "Unnamed teammate"]));
    const num = (v: unknown) => (v == null ? null : Number(v));
    const rows: StatRow[] = (data ?? []).filter((r) => !hiddenS.has(String(r.session_id))).map((r) => ({
      sessionId: String(r.session_id), repId: String(r.rep_id), version: Number(r.transcript_version),
      talkRatioTime: num(r.talk_ratio_time), longestRepMonologueMs: num(r.longest_rep_monologue_ms), longestCustomerStoryMs: num(r.longest_customer_story_ms),
      interactivity: num(r.interactivity), patienceMs: num(r.patience_ms), repQuestionsPerHour: num(r.rep_questions_per_hour),
    }));
    const stats = teamCallStats(rows, names);
    return done({ days, reps: stats.reps, team: stats.team, note: "Phone and video calls; calls with an active hide are left out." });
  }
  if (resource === "scores") {
    // Call scores (Engage plan E13; Gong F15.19), newest first: the stored verdict (a manager's corrections are already
    // in it, 0255) and each item's grade and points. Never the transcript, the audio, the evidence quotes or the
    // not-counting reason (free text that can quote the call); a score on a call with an active hide is left out.
    let hiddenS: Set<string>;
    try {
      hiddenS = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
    } catch {
      return done({ error: "Couldn't read scores." }, 500);
    }
    const { data, error } = await admin
      .from("pitch_scores")
      .select("id, session_id, rep_id, recorded_at, outcome, base, bonus, violations, total, band, qualifying, rubric_version, section_points, created_at")
      .eq("company_id", caller.companyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) return done({ error: "Couldn't read scores." }, 500);
    const shown = (data ?? []).filter((p) => !(p.session_id && hiddenS.has(String(p.session_id))));
    const ids = shown.map((p) => String(p.id));
    // Paged to the end (a page of scores can carry more item rows than one read returns, max_rows=1000).
    const { data: els, error: eErr } = ids.length
      ? await fetchAllPagedResult<{ id: string; pitch_id: string; element_id: string; grade: string; points: number | string }>(
          (f, t) => admin.from("pitch_score_elements").select("id, pitch_id, element_id, grade, points").eq("company_id", caller.companyId).in("pitch_id", ids).order("id", { ascending: true }).range(f, t),
          { label: "api score items", maxRows: 20_000 },
        )
      : { data: [], error: null };
    if (eErr) return done({ error: "Couldn't read scores." }, 500);
    const byPitch = new Map<string, Array<{ element_id: string; grade: string; points: number | string }>>();
    for (const e of (els ?? []) as Array<{ pitch_id: string; element_id: string; grade: string; points: number | string }>) byPitch.set(String(e.pitch_id), [...(byPitch.get(String(e.pitch_id)) ?? []), e]);
    const num = (v: unknown) => (v == null ? null : Number(v));
    return done({
      data: shown.map((p) => {
        const rubric = rubricByVersion(p.rubric_version as string | null);
        const order = new Map([...rubric.elementsById.keys()].map((id, i) => [id, i]));
        return {
          id: p.id, callId: p.session_id, repId: p.rep_id, recordedAt: p.recorded_at, outcome: p.outcome,
          total: num(p.total), base: num(p.base), bonus: num(p.bonus), violations: num(p.violations), band: p.band, counts: p.qualifying,
          rubricVersion: p.rubric_version, sections: p.section_points ?? null, scoredAt: p.created_at,
          items: (byPitch.get(String(p.id)) ?? [])
            .sort((a, b) => (order.get(a.element_id) ?? 999) - (order.get(b.element_id) ?? 999))
            .map((e) => ({ id: e.element_id, label: rubric.elementsById.get(e.element_id)?.label ?? e.element_id, grade: e.grade, points: num(e.points) })),
        };
      }),
      page,
      limit,
      // A page can hold fewer than `limit` once hidden ones are left out (review 2026-11-28): `more` says whether to read on.
      more: (data ?? []).length === limit,
      note: "Scores on calls with an active hide are left out; evidence quotes are not sent. A page may hold fewer than `limit` rows: read on while `more` is true.",
    });
  }
  if (resource === "todos") {
    // The to-dos on deals (Engage plan E16; Gong F31.3): a deal's link, then the task. Pages by link, newest first.
    const { data: links, error } = await admin.from("remote_prospect_tasks").select("id, prospect_id, task_id, created_at").eq("company_id", caller.companyId).order("id", { ascending: false }).range(from, to);
    if (error) return done({ error: "Couldn't read to-dos." }, 500);
    const rows = (links ?? []) as Array<{ id: number; prospect_id: string; task_id: string; created_at: string }>;
    const { data: tasks, error: tErr } = rows.length
      ? await admin.from("tasks").select("id, title, status, due_date, assignee_user_id, created_at").eq("company_id", caller.companyId).in("id", rows.map((r) => r.task_id)).is("deleted_at", null)
      : { data: [], error: null };
    if (tErr) return done({ error: "Couldn't read to-dos." }, 500);
    const byId = new Map(((tasks ?? []) as Array<{ id: string; title: string; status: string | null; due_date: string | null; assignee_user_id: string | null; created_at: string }>).map((t) => [String(t.id), t]));
    return done({
      data: rows.filter((r) => byId.has(String(r.task_id))).map((r) => {
        const t = byId.get(String(r.task_id))!;
        return { id: t.id, dealId: r.prospect_id, title: t.title, status: t.status, due: t.due_date, assigneeId: t.assignee_user_id, createdAt: t.created_at };
      }),
      page,
      limit,
      more: rows.length === limit,
      note: "Deleted to-dos are left out. A page may hold fewer than `limit` rows: read on while `more` is true.",
    });
  }
  if (resource === "library") {
    // The company library (Engage plan E16; Gong F31.3): company folders only — a person's own folders stay theirs
    // (F12.8) — with their calls, without the free-text note; archived folders, removed items and calls with an active
    // hide left out. Small enough to answer whole (folders capped, items paged to the end).
    let hiddenS: Set<string>;
    try {
      hiddenS = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
    } catch {
      return done({ error: "Couldn't read the library." }, 500);
    }
    const [folders, events, removals] = await Promise.all([
      fetchAllPagedResult<{ id: string; name: string; parent_id: string | null; created_at: string }>((f, t) => admin.from("library_folders").select("id, name, parent_id, created_at").eq("company_id", caller.companyId).eq("is_company", true).order("id").range(f, t), { label: "api library folders", maxRows: 5000 }),
      fetchAllPagedResult<{ id: number; folder_id: string; kind: string }>((f, t) => admin.from("library_folder_events").select("id, folder_id, kind").eq("company_id", caller.companyId).in("kind", ["archive", "restore"]).order("id").range(f, t), { label: "api library folder events", maxRows: 20_000 }),
      fetchAllPagedResult<{ id: number; item_id: string }>((f, t) => admin.from("library_item_removals").select("id, item_id").eq("company_id", caller.companyId).order("id").range(f, t), { label: "api library removals", maxRows: 50_000 }),
    ]);
    if (folders.error || events.error || removals.error) return done({ error: "Couldn't read the library." }, 500);
    // A folder is archived when its latest archive/restore event is "archive" (0346).
    const last = new Map<string, string>();
    for (const e of events.data ?? []) last.set(String(e.folder_id), e.kind);
    const live = (folders.data ?? []).filter((f) => last.get(String(f.id)) !== "archive");
    const ids = live.map((f) => String(f.id));
    const removed = new Set((removals.data ?? []).map((r) => String(r.item_id)));
    const items = ids.length
      ? await fetchAllPagedResult<{ id: string; folder_id: string; session_id: string | null; rep_id: string | null; created_at: string }>((f, t) => admin.from("library_items").select("id, folder_id, session_id, rep_id, created_at").eq("company_id", caller.companyId).in("folder_id", ids).order("id").range(f, t), { label: "api library items", maxRows: 50_000 })
      : { data: [], error: null };
    if (items.error) return done({ error: "Couldn't read the library." }, 500);
    const byFolder = new Map<string, Array<{ id: string; callId: string | null; repId: string | null; addedAt: string }>>();
    for (const it of items.data ?? []) {
      if (removed.has(String(it.id)) || (it.session_id && hiddenS.has(String(it.session_id)))) continue;
      byFolder.set(String(it.folder_id), [...(byFolder.get(String(it.folder_id)) ?? []), { id: it.id, callId: it.session_id, repId: it.rep_id, addedAt: it.created_at }]);
    }
    return done({
      data: live.map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id, createdAt: f.created_at, items: byFolder.get(String(f.id)) ?? [] })),
      note: "Company folders only; archived folders, removed items and calls with an active hide are left out.",
    });
  }
  if (resource === "flows") {
    // Company flows and every enrolment (Engage plan E16; Gong F24.7). A person's own flows are theirs; an enrolment
    // in one is listed with its flow id. Steps are the manager's text (subjects and bodies of email steps).
    const [flows, enrolments] = await Promise.all([
      admin.from("engage_flows").select("id, name, steps, owner_id, created_at").eq("company_id", caller.companyId).eq("is_company", true).is("retired_at", null).order("created_at", { ascending: false }).limit(200),
      admin.from("engage_enrolments").select("id, flow_id, prospect_id, contact_id, rep_id, created_at").eq("company_id", caller.companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
    ]);
    if (flows.error || enrolments.error) return done({ error: "Couldn't read flows." }, 500);
    return done({
      flows: (flows.data ?? []).map((f) => ({ id: f.id, name: f.name, steps: f.steps, ownerId: f.owner_id, createdAt: f.created_at })),
      enrolments: (enrolments.data ?? []).map((e) => ({ id: e.id, flowId: e.flow_id, dealId: e.prospect_id, contactId: e.contact_id, repId: e.rep_id, createdAt: e.created_at })),
      page,
      limit,
      more: (enrolments.data ?? []).length === limit,
    });
  }
  if (resource === "audit") {
    // The audit log (0284; Gong F31.5) is for company admins: the key's maker must still be one (a key outlives a role
    // change, so this is checked on every request, not only when the key was made).
    const { data: maker, error: mErr } = await admin.from("profiles").select("role, status").eq("company_id", caller.companyId).eq("id", caller.createdBy).maybeSingle();
    if (mErr) return done({ error: "Couldn't read the audit log." }, 500);
    if (!maker || maker.status === "removed" || !isAdminRole(maker.role as string | null)) {
      return done({ error: "The audit log is for company admins; the person who made this key isn't one now." }, 403);
    }
    // ?before=<id> pages by id (review 2026-11-27): the log grows while a tool reads it, and page offsets would repeat
    // rows. ?page still works for the first page.
    const before = Number(url.searchParams.get("before"));
    let q = admin.from("audit_log").select("id, actor_id, action, object_type, object_id, meta, created_at").eq("company_id", caller.companyId).order("id", { ascending: false });
    q = Number.isInteger(before) && before > 0 ? q.lt("id", before).limit(limit) : q.range(from, to);
    const { data, error } = await q;
    if (error) return done({ error: "Couldn't read the audit log." }, 500);
    // What leaves keeps this API's own rule (review 2026-11-27): a row about a call with an active hide is left out, and
    // free text or secrets in the details (a hide phrase, a grant's reason, a webhook URL, an erasure hint) are removed.
    let hidden: Set<string>;
    try {
      hidden = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
    } catch {
      return done({ error: "Couldn't read the audit log." }, 500);
    }
    const rows = (data ?? []).filter((r) => !(r.object_type === "coaching_session" && hidden.has(String(r.object_id))));
    const last = (data ?? []).at(-1);
    return done({
      data: rows.map((r) => ({ id: r.id, at: r.created_at, action: r.action, actorId: r.actor_id, objectType: r.object_type, objectId: r.object_id, meta: auditMetaForApi(r.meta) })),
      page,
      limit,
      next: (data ?? []).length === limit && last ? `?before=${last.id}&limit=${limit}` : null,
    });
  }
  let hidden: Set<string>;
  try {
    hidden = await hiddenInCompanyFrom(admin, caller.companyId, OUTSIDE_READER);
  } catch {
    return done({ error: "Couldn't read calls." }, 500);
  }
  const { data, error } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, context, session_kind, started_at, ended_at, outcome")
    .eq("company_id", caller.companyId)
    .in("context", ["phone", "video"])
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) return done({ error: "Couldn't read calls." }, 500);
  return done({
    data: (data ?? []).filter((s) => !hidden.has(String(s.id))).map((s) => ({ id: s.id, repId: s.agent_id, channel: s.context, kind: s.session_kind, startedAt: s.started_at, endedAt: s.ended_at, outcome: s.outcome })),
    page,
    limit,
    more: (data ?? []).length === limit,
    note: "Calls with an active hide are left out. A page may hold fewer than `limit` rows: read on while `more` is true.",
  });
}

/** Audit details keys that hold free text or secrets: never sent through the API (the app's admin view keeps them). */
export const AUDIT_META_WITHHELD = ["phrase", "reason", "url", "hint", "note", "text", "value", "query", "name", "email"] as const;

/** An audit row's details with the withheld keys removed (one level; nested objects are dropped). Pure. */
export function auditMetaForApi(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if ((AUDIT_META_WITHHELD as readonly string[]).includes(k)) continue;
    if (v !== null && typeof v === "object") continue;
    out[k] = v;
  }
  return out;
}

