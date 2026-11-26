import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { NextRequest, NextResponse } from "next/server";
import { outcomeConnected } from "@/lib/coach/v5/outcomeLabels";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { teamFromRequest } from "@/lib/coach/remote/teamScope";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterRepsChecked, treeAllowsRepChecked } from "@/lib/api/treeAccess";
import { buildUsage, mergeSignIns, type UsageEvent } from "@/lib/coach/remote/usage";

/**
 * GET /api/coach/remote/usage — how much the team uses the product, last 7 and 30 days (2026-11-23, usage.ts).
 * Managers only; the people are the company's members filtered to the caller's reporting tree (treeFilterReps), and
 * every read below is pinned to the company AND to those people. Sign-ins come from login_attempts, which is keyed by
 * email, so each person's email is looked up from their sign-in account on the server and never returned.
 * Any failed read is a 500 — a usage page that silently drops a source would under-report and look like low adoption.
 */
const DAY = 86_400_000;
/** PostgREST returns at most 1000 rows; a source that hits it is reported as capped, never silently cut. */
const CAP = 1000;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-usage", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  // ?team=<manager> (F10.9 / F16.6): narrow to one manager's team — never wider than the caller's own access.
  const scope = await teamFromRequest(req, createAdminClient, mgr.companyId, (id) => (id === mgr.userId ? Promise.resolve(true) : treeAllowsRepChecked(req, id)));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const inTeam = (id: string) => !scope.members || scope.members.has(id);
  const admin = createAdminClient();
  const fail = (what: string, msg?: string) => {
    console.error(`[usage] ${what} failed company=${mgr.companyId}: ${msg ?? ""}`);
    return NextResponse.json({ error: "Couldn't load team usage." }, { status: 500 });
  };

  // Every person, then the tree (2026-11-26: a company past 1,000 people lost the rest before the filter).
  const { data: profs, error: pErr } = await fetchAllPagedResult<{ id: string; full_name: string | null }>(
    (from, to) => admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).order("id", { ascending: true }).range(from, to),
    { label: "usage people", maxRows: 50_000 },
  );
  if (pErr) return fail("profiles", pErr.message);
  const treeIds = await treeFilterRepsChecked(req, ((profs ?? []) as Array<{ id: string }>).map((p) => p.id));
  if (treeIds === null) return fail("tree check", "rss_tree_filter"); // not "only you" (review 2026-11-26)
  const visible = new Set(treeIds);
  visible.add(mgr.userId);
  const members = ((profs ?? []) as Array<{ id: string; full_name: string | null }>)
    .filter((p) => visible.has(p.id) && inTeam(p.id))
    .map((p) => ({ id: p.id, name: p.full_name ?? "Unnamed teammate" }));
  const ids = members.map((m) => m.id);
  if (!ids.length) return NextResponse.json({ ...buildUsage([], [], Date.now()), windowDays: 30 });
  const since = new Date(Date.now() - 30 * DAY).toISOString();

  const [sessions, chats, attempts, pevents] = await Promise.all([
    admin.from("coaching_sessions").select("agent_id, started_at, ended_at, audio_duration_seconds, context, outcome").eq("company_id", mgr.companyId).in("agent_id", ids).gte("started_at", since).limit(CAP),
    admin.from("ask_coach_chats").select("id, owner_id").eq("company_id", mgr.companyId).in("owner_id", ids).limit(CAP),
    admin.from("training_attempts").select("rep_id, created_at").eq("company_id", mgr.companyId).in("rep_id", ids).gte("created_at", since).limit(CAP),
    admin.from("remote_prospect_events").select("actor_id, created_at").eq("company_id", mgr.companyId).in("actor_id", ids).gte("created_at", since).limit(CAP),
  ]);
  if (sessions.error) return fail("sessions", sessions.error.message);
  if (chats.error) return fail("chats", chats.error.message);
  if (attempts.error) return fail("attempts", attempts.error.message);
  if (pevents.error) return fail("pipeline", pevents.error.message);

  const ownerOf = new Map(((chats.data ?? []) as Array<{ id: string; owner_id: string }>).map((c) => [c.id, c.owner_id]));
  let turns: Array<{ chat_id: string; created_at: string }> = [];
  if (ownerOf.size) {
    const t = await admin.from("ask_coach_turns").select("chat_id, created_at").eq("company_id", mgr.companyId).eq("role", "user").in("chat_id", [...ownerOf.keys()]).gte("created_at", since).limit(CAP);
    if (t.error) return fail("questions", t.error.message);
    turns = (t.data ?? []) as typeof turns;
  }

  // Sign-ins (0327): every method — auth.sessions (Google, Microsoft, the mobile app, the web) and login_attempts (the
  // web form, kept after sign-out) — matched by user id inside the database; one sign-in recorded twice counts once.
  const { data: signRows, error: sErr } = await admin.rpc("rss_sign_in_times", { p_company: mgr.companyId, p_users: ids, p_since: since });
  if (sErr) return fail("sign-ins", sErr.message);
  const logins = mergeSignIns(((signRows ?? []) as Array<{ user_id: string; at: string; source: string }>).map((r) => ({ userId: String(r.user_id), at: r.at, source: r.source })));

  const events: UsageEvent[] = [
    // A call's length only from conversationDurationSeconds (audio length, else a capped wall-clock span; null = unknown).
    ...((sessions.data ?? []) as Array<{ agent_id: string; started_at: string; ended_at: string | null; audio_duration_seconds: number | null; context: string | null; outcome: string | null }>).map((r) => ({
      personId: r.agent_id,
      kind: "calls" as const,
      at: r.started_at,
      seconds: conversationDurationSeconds(r.audio_duration_seconds, r.started_at, r.ended_at),
      // Connect rate (F25.8): phone and video calls only; a door knock or meeting isn't judged.
      connected: isRemoteContext(r.context) ? outcomeConnected(r.outcome) : null,
    })),
    ...turns.map((r) => ({ personId: ownerOf.get(r.chat_id) ?? "", kind: "questions" as const, at: r.created_at })),
    ...((attempts.data ?? []) as Array<{ rep_id: string; created_at: string }>).map((r) => ({ personId: r.rep_id, kind: "practice" as const, at: r.created_at })),
    ...((pevents.data ?? []) as Array<{ actor_id: string; created_at: string }>).map((r) => ({ personId: r.actor_id, kind: "pipeline" as const, at: r.created_at })),
    ...logins.map((r) => ({ personId: r.personId, kind: "signIns" as const, at: r.at })),
  ];
  const capped = [
    ["calls", (sessions.data ?? []).length],
    ["questions", turns.length],
    ["question threads", (chats.data ?? []).length],
    ["practice", (attempts.data ?? []).length],
    ["pipeline updates", (pevents.data ?? []).length],
    ["sign-ins", (signRows ?? []).length],
  ].filter(([, n]) => n === CAP).map(([k]) => k);
  return NextResponse.json({ ...buildUsage(members, events, Date.now()), windowDays: 30, capped });
}
