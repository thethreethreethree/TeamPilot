import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { contextsOf } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import type { Intel, MarketCall, TopicGroup } from "./market";

/**
 * The reads behind Market (2026-11-23): the calls in view through the CALLER's client (a manager's tree, a rep's own),
 * sales calls only, each with its latest intel event; and the company's current topic groups (0319). Shared by the
 * Market route and the topic-group suggestion route so both see the same topics. A failed read is an error, never an
 * empty market (§3.4).
 */
const CHUNK = 100;
const MISSING = new Set(["PGRST205", "42P01"]);

export async function readMarketInputs(
  db: SupabaseClient,
  callModule: "remote_sales" | "sales_coach",
  days: number,
): Promise<{ ok: true; calls: MarketCall[]; intel: Map<string, Intel> } | { ok: false; what: string; message: string }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const sessions = await fetchAllPagedResult<{ id: string; started_at: string; outcome: string | null; session_kind: string | null }>(
    (from, to) =>
      db.from("coaching_sessions").select("id, started_at, outcome, session_kind").in("context", [...contextsOf(callModule)]).gte("started_at", since).order("started_at").order("id").range(from, to),
    { label: "market sessions" },
  );
  if (sessions.error) return { ok: false, what: "sessions", message: sessions.error.message };
  const calls: MarketCall[] = (sessions.data ?? []).filter((s) => isSalesCall(s.session_kind)).map((s) => ({ sessionId: s.id, startedAt: s.started_at, outcome: s.outcome }));

  const intel = new Map<string, Intel>();
  const subjects = calls.map((c) => `sales_session:${c.sessionId}`);
  for (let i = 0; i < subjects.length; i += CHUNK) {
    const ev = await fetchAllPagedResult<{ subject: string; payload: { intel?: { competitors?: unknown; topics?: unknown } } | null; created_at: string; id: string }>(
      (from, to) =>
        db.from("events").select("subject, payload, created_at, id").eq("kind", "coach.session_intel_generated").in("subject", subjects.slice(i, i + CHUNK)).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
      { label: "market intel" },
    );
    if (ev.error) return { ok: false, what: "intel", message: ev.error.message };
    for (const e of ev.data ?? []) {
      const sid = String(e.subject).replace("sales_session:", "");
      if (intel.has(sid)) continue; // newest first: the call's latest intel wins
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);
      intel.set(sid, { competitors: list(e.payload?.intel?.competitors), topics: list(e.payload?.intel?.topics) });
    }
  }
  return { ok: true, calls, intel };
}

/** The company's current topic groups, newest first: every group minus the retired ones. Before 0319: none. */
export async function readTopicGroups(db: SupabaseClient, companyId: string): Promise<{ ok: true; groups: Array<TopicGroup & { source: string; createdAt: string }> } | { ok: false; message: string }> {
  const [g, r] = await Promise.all([
    db.from("market_topic_groups").select("id, name, members, source, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(500),
    db.from("market_topic_group_retirements").select("group_id").eq("company_id", companyId).limit(1000),
  ]);
  if (g.error && MISSING.has(String(g.error.code))) return { ok: true, groups: [] };
  if (g.error) return { ok: false, message: g.error.message };
  if (r.error && !MISSING.has(String(r.error.code))) return { ok: false, message: r.error.message };
  const retired = new Set(((r.data ?? []) as Array<{ group_id: string }>).map((x) => String(x.group_id)));
  const groups = ((g.data ?? []) as Array<{ id: string; name: string; members: string[]; source: string; created_at: string }>)
    .filter((x) => !retired.has(String(x.id)))
    .map((x) => ({ id: String(x.id), name: x.name, members: x.members ?? [], source: x.source, createdAt: x.created_at }));
  return { ok: true, groups };
}
