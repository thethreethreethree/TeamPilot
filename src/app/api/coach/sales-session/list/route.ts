import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifySession,
  extractSessionSignals,
  gateSessionFlag,
  type SessionFlag,
} from "@/lib/coach/v5/sessionFlag";

/**
 * GET /api/coach/sales-session/list
 *
 * Phase 1 of the Sessions history. Staff see their OWN sessions; managers
 * (company admin OR sales_coach admin) see the COMPANY's, with which agent
 * ran each — for coaching VISIBILITY, never ranking (§A18): chronological
 * order, no scores. Each row carries dissect/summary/review badges from a
 * single bounded events query (no per-session cue load — that's the
 * unbounded/N+1 class). Existing data only.
 *
 * Bounded to the most recent 300 sessions; the page filters client-side.
 */
async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
  return {
    ok: true as const,
    userId: auth.user.id,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function GET(req: Request) {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // Server-side filters (backlog: move context/status/period into the DB query
  // so filtering is no longer trapped inside the 300-row cap — A21: this
  // EXTENDS the existing query, it doesn't fork it). TEXT SEARCH stays entirely
  // client-side: it matches client-label AND agent-name, and agent names live
  // in a separate profiles join — pushing a client_label ilike server-side would
  // make an agent-name search return zero rows with nothing to recover from.
  // Unknown/absent filter values are ignored (honest no-op, not an error).
  const params = new URL(req.url).searchParams;
  const fContext = params.get("context");
  const fStatus = params.get("status");
  const fPeriod = params.get("period");

  const admin = createAdminClient();

  let query = admin
    .from("coaching_sessions")
    .select(
      "id, agent_id, client_label, context, status, started_at, ended_at, territory, offer, outcome"
    )
    .eq("company_id", ctx.companyId)
    .order("started_at", { ascending: false })
    .limit(300);
  // Staff: only their own sessions.
  if (!ctx.isManager) {
    query = query.eq("agent_id", ctx.userId);
  }
  // Apply the server-side filters (validated against the known enums).
  if (fContext === "in_person" || fContext === "video") {
    query = query.eq("context", fContext);
  }
  if (fStatus === "active" || fStatus === "ended" || fStatus === "reviewed") {
    query = query.eq("status", fStatus);
  }
  if (fPeriod === "7d" || fPeriod === "30d") {
    const days = fPeriod === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    query = query.gte("started_at", since);
  }
  const { data: sessionsData, error: sErr } = await query;
  if (sErr) {
    return NextResponse.json({ degraded: true });
  }
  const sessions = sessionsData ?? [];

  // Which sessions have a dissect / summary / review — one bounded query,
  // scoped to exactly these sessions' subjects.
  const subjects = sessions.map((s) => `sales_session:${s.id}`);
  const dissect = new Set<string>();
  const summary = new Set<string>();
  const review = new Set<string>();
  // §3.4: if the badge query fails (incl. a too-long subject .in()), do NOT
  // render every session as un-dissected — flag it so the page says the
  // status is unavailable rather than asserting a false "nothing generated".
  let badgesAvailable = true;
  if (subjects.length > 0) {
    const { data: events, error: eErr } = await admin
      .from("events")
      .select("kind, subject")
      .in("kind", [
        "coach.dissect_generated",
        "coach.session_summary_generated",
        "coach.sales_review_generated",
      ])
      .in("subject", subjects);
    if (eErr) badgesAvailable = false;
    for (const e of events ?? []) {
      const sid = String(e.subject ?? "").replace("sales_session:", "");
      if (e.kind === "coach.dissect_generated") dissect.add(sid);
      else if (e.kind === "coach.session_summary_generated") summary.add(sid);
      else if (e.kind === "coach.sales_review_generated") review.add(sid);
    }
  }

  // Interaction-flag signals (founder 2026-07-09): the pivot + timeline-sentiment
  // payloads, per session. §A18: these are MANAGER-VISIBLE observations — the flag
  // deliberately does NOT read the owner-private After-Pitch scores, so it cannot
  // leak them to a manager. Separate query so the badge query above stays
  // payload-free (dissect/summary payloads are large; we don't need them). Latest
  // event per (session, kind) wins — order desc, first seen kept. All PARSING lives
  // in the tested extractSessionSignals(); here we only collect the raw payloads.
  const pivotPayloadBySession = new Map<string, unknown>();
  const momentsPayloadBySession = new Map<string, unknown>();
  if (subjects.length > 0) {
    const { data: sig } = await admin
      .from("events")
      .select("kind, subject, payload, created_at")
      .in("kind", [
        "coach.session_pivot_generated",
        "coach.session_moments_generated",
      ])
      .in("subject", subjects)
      .order("created_at", { ascending: false });
    for (const e of sig ?? []) {
      const sid = String(e.subject ?? "").replace("sales_session:", "");
      if (e.kind === "coach.session_pivot_generated" && !pivotPayloadBySession.has(sid)) {
        pivotPayloadBySession.set(sid, e.payload);
      } else if (
        e.kind === "coach.session_moments_generated" &&
        !momentsPayloadBySession.has(sid)
      ) {
        momentsPayloadBySession.set(sid, e.payload);
      }
    }
  }

  const flagFor = (
    id: string,
    outcome: string | null,
    status: string
  ): SessionFlag | null => {
    const signals = extractSessionSignals({
      outcome,
      pivotPayload: pivotPayloadBySession.get(id) ?? null,
      momentsPayload: momentsPayloadBySession.get(id) ?? null,
    });
    // gateSessionFlag enforces the two surface invariants (active-skip + manager-only
    // examination) — extracted + unit-tested so the rep-never-sees-examination rule
    // can't silently regress.
    return gateSessionFlag(classifySession(signals), {
      status,
      isManager: ctx.isManager,
    });
  };

  // Agent names — manager view only (per-agent visibility, not ranking).
  const names = new Map<string, string | null>();
  if (ctx.isManager) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", ctx.companyId);
    for (const p of profs ?? []) names.set(p.id as string, p.full_name as string | null);
  }

  const rows = sessions.map((s) => {
    const id = s.id as string;
    return {
      id,
      clientLabel: (s.client_label as string | null) ?? null,
      context: s.context as "in_person" | "video",
      status: s.status as "active" | "ended" | "reviewed",
      startedAt: s.started_at as string,
      endedAt: (s.ended_at as string | null) ?? null,
      territory: (s.territory as string | null) ?? null,
      offer: (s.offer as string | null) ?? null,
      outcome: (s.outcome as string | null) ?? null,
      agentName: ctx.isManager
        ? (names.get(s.agent_id as string) ?? "Unnamed")
        : null,
      hasDissect: dissect.has(id),
      hasSummary: summary.has(id),
      hasReview: review.has(id),
      flag: flagFor(id, (s.outcome as string | null) ?? null, s.status as string),
    };
  });

  // Diagnostic (instrument-first): if flags under-appear, this one line names why —
  // how many ended sessions carry an outcome / pivot / moments, and how many
  // classified. Read it in the server logs before any speculative re-fix.
  if (ctx.isManager) {
    const ended = sessions.filter((s) => s.status !== "active");
    const flagged = rows.filter((r) => r.flag);
    // eslint-disable-next-line no-console
    console.error(
      `[salesSession.list] flags: ended=${ended.length} withOutcome=${
        ended.filter((s) => s.outcome).length
      } withPivot=${pivotPayloadBySession.size} withMoments=${
        momentsPayloadBySession.size
      } flagged=${flagged.length} (exam=${
        flagged.filter((r) => r.flag?.kind === "examination").length
      } outstanding=${
        flagged.filter((r) => r.flag?.kind === "outstanding").length
      })`
    );
  }

  return NextResponse.json({
    isManager: ctx.isManager,
    sessions: rows,
    badgesAvailable,
  });
}
