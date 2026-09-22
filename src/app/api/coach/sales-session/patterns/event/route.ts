import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { canAppend, BODY_REQUIRED } from "@/lib/coach/patterns/eventPermission";

/**
 * POST /api/coach/sales-session/patterns/event — the four manager actions and the rep's reply.
 *
 * THE WRITE HALF OF A TABLE THAT HAS EXISTED SINCE 0258 AND HAS NEVER BEEN WRITTEN TO. Until this
 * route, `pattern_events` accepted six kinds and received none, which made three of the five
 * pattern statuses unreachable — `coaching`, `improving` and `stalled` all require a coaching
 * instant, and nothing produced one. Every pattern in the product was New or Fixed and the whole
 * lifecycle the guide describes was decorative. That is A31 at its largest in this build cycle.
 *
 * NO RLS INSERT POLICY EXISTS ON THIS TABLE, deliberately (0258), so this route IS the access
 * rule and there is no database behind it to catch a mistake. The rule therefore lives in
 * `eventPermission.ts`, unit-tested without a database, and this route consumes its verdict
 * rather than re-expressing it (§2.2). A rep marking their own pattern coached would make the
 * Stalled rule unfalsifiable; a manager ticking `rep_reviewed` would turn the acknowledgement
 * tile into a record of their own opinion.
 *
 * A MANUAL CLOSE WRITES THE COLUMN THE RESOLVER READS. `fixed` appends its event AND sets
 * `patterns.fixed_at`, because `statusOf` decides Fixed from `fixedAt` or a five-clean streak.
 * Writing only the event would create a second authority on the one fact four surfaces consume.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pattern-event", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let payload: { patternId?: unknown; kind?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const patternId = typeof payload.patternId === "string" ? payload.patternId : "";
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : null;

  if (!patternId) return NextResponse.json({ error: "Which pattern?" }, { status: 400 });
  if (body !== null && body.length > 2000) {
    return NextResponse.json({ error: "Keep a note under 2000 characters." }, { status: 400 });
  }
  if (BODY_REQUIRED.has(kind) && body === null) {
    // A note with no words is not an event, and `clip_disputed` with no words is an objection a
    // manager cannot act on.
    return NextResponse.json({ error: "This one needs something written in it." }, { status: 400 });
  }

  // The pattern, read with the service role because the answer decides authorisation and must not
  // itself depend on the caller's visibility.
  const admin = createAdminClient();
  const { data: pattern } = await admin
    .from("patterns")
    .select("id, company_id, rep_id, fixed_at")
    .eq("id", patternId)
    .maybeSingle();

  // Same company or nothing. An admin-client read means RLS is not carrying this.
  if (!pattern || pattern.company_id !== ctx.companyId) {
    return NextResponse.json({ error: "Pattern not found." }, { status: 404 });
  }

  const manager = await requireSalesCoachManager(req);
  const verdict = canAppend(kind, {
    isManager: manager !== null,
    ownsPattern: String(pattern.rep_id) === ctx.userId,
  });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 403 });
  }

  const { data: inserted, error } = await admin
    .from("pattern_events")
    .insert({
      company_id: ctx.companyId,
      pattern_id: patternId,
      actor_id: ctx.userId,
      kind: verdict.kind,
      body,
    })
    .select("id, kind, body, created_at, actor_id")
    .maybeSingle();

  if (error || !inserted) {
    // Never the database's words: the message can carry a constraint name or a row fragment and
    // this response reaches a browser (CWE-209).
    console.error(
      `[pattern-event] insert failed pattern=${patternId} kind=${verdict.kind} actor=${ctx.userId}: ${error?.message ?? "no row"}`
    );
    return NextResponse.json({ error: "Could not record that." }, { status: 500 });
  }

  /**
   * A MANUAL CLOSE ALSO SETS THE COLUMN, and only when it is not already set.
   *
   * `statusOf` reads `fixedAt`; the event alone would leave the resolver — and therefore all four
   * surfaces that consume it — still calling the pattern open. Guarded on the existing value so
   * closing an already-closed pattern does not move its date, which would restate when the rep
   * fixed it and skew every days-to-fix average on the Rep progress board.
   *
   * Best-effort in the sense that the event is already on the record: if this fails, the log
   * shows a manager closed it and the board still shows it open, which is a visible
   * inconsistency someone will report — better than a 500 that loses both.
   */
  let closed = false;
  if (verdict.kind === "fixed" && !pattern.fixed_at) {
    const { error: closeError } = await admin
      .from("patterns")
      .update({ fixed_at: new Date().toISOString() })
      .eq("id", patternId)
      .is("fixed_at", null);
    if (closeError) {
      console.error(`[pattern-event] close failed pattern=${patternId}: ${closeError.message}`);
    } else {
      closed = true;
    }
  }

  return NextResponse.json({ event: inserted, closed });
}
