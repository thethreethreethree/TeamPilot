import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * POST /api/coach/sales-session/[id]/save-recording   body: { saved?: boolean }  (default true)
 *
 * ELOSALES Standard revision (PDF Sessions item 1b): recordings auto-delete after 2 days "unless saved by the
 * manager or user." This sets `recording_saved` so the 0187 retention purge exempts the recording.
 *
 * Authz — either party the PDF names may save:
 *   - the OWNING rep (session.agent_id = caller), or
 *   - a MANAGER (sales_coach_role=admin OR CEO/COO/admin) in the SAME company.
 * Uses the admin client for the write BECAUSE a sales_coach_role=admin manager is not covered by the
 * coaching_sessions RLS update policy (owner + company-admin only) — so authz is enforced in-code here first,
 * then the write goes through service-role. No cross-company or non-privileged caller can reach the write.
 * Standard-only surface; Expert never calls this.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, { id: "coach-save-recording", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { saved?: unknown };
  const saved = body.saved === undefined ? true : body.saved === true;

  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("coaching_sessions")
    .select("id, agent_id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.company_id !== companyId) {
    // Cross-company or missing → indistinguishable 404 (never confirm another tenant's session exists).
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const isOwner = session.agent_id === auth.user.id;
  const isManager = isSalesCoachManager({
    role: profile?.role ?? null,
    sales_coach_role: profile?.sales_coach_role ?? null,
    company_id: companyId,
  });
  if (!isOwner && !isManager) {
    return NextResponse.json(
      { error: "Only the rep or a manager can save this recording." },
      { status: 403 }
    );
  }

  // CORRECTION (2026-07-17, A13/A21): the first version of this comment cited team/route.ts as "the precedent
  // the codebase already decides this by." WRONG PRECEDENT. The real structural fix exists —
  // `src/lib/supabase/strictUpdate.ts` (`strictMutate`/`strictMutateOne`), built as A13's prescribed remedy
  // after the CAT-001 recovery window, unit-tested, and used at 8+ sites in src/lib/data/care.ts. team/route.ts
  // is itself an INLINE instance — an example of the per-function patching A13 calls the wrong fix — so citing
  // it as precedent propagated the very thing the helper exists to eliminate.
  //
  // Why this route still hand-rolls it (stated, not assumed): strictMutate's contract is "throw; the API layer
  // converts to 4xx/5xx" — it is built to be called from the DATA layer (care.ts is one). This route IS the API
  // layer and needs THREE outcomes a generic throw cannot express: 503 when 0187 is unapplied
  // (isMissingColumnError, above), 500 on a real error, 404 on zero rows. Collapsing those into a thrown Error
  // and re-parsing its message would be worse. The honest residual: the coach module never adopted the helper
  // the C.A.R.E audit built (A21 — the drift is invisible from inside either module); aligning them is a real
  // refactor with error-semantics consequences, outside this revision's blast radius.
  //
  // A29 swept the class of tonight's purge fix ("a mutation reporting success without asserting the effect
  // landed") into this handler, and found it here: the route returned {recording_saved: saved} whether or not a
  // row actually changed — the same false-ok shape as the 558ce56 team-removal bug. Two fixes:
  //   • company_id scope: defence in depth. The tenant check above reads the row first, so this is belt-and-
  //     braces against a TOCTOU race (row re-tenanted between read and write) and against a future edit that
  //     drops the earlier check — the write itself is now unable to leave the caller's company.
  //   • rowcount assert: 0 rows means the row vanished or moved between the read and this write. Saying "saved"
  //     then would be a phantom success on a RETENTION control — the recording would purge while the UI shows
  //     Saved. An honest 404 is the §3.4 answer.
  const { data: updated, error } = await admin
    .from("coaching_sessions")
    .update({
      recording_saved: saved,
      recording_saved_by: saved ? auth.user.id : null,
      recording_saved_at: saved ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id");
  if (error) {
    // Migration-coupling (2026-07-03 lesson): the recording_saved columns land with 0187. Until it's applied a
    // save can't succeed — but return an honest, non-leaking message with a transient status, never the raw
    // pg schema string ("column ... does not exist"). Unlike the read path there's no lossless fallback: a
    // save requires the column to persist to.
    if (isMissingColumnError(error, "recording_saved")) {
      return NextResponse.json(
        { error: "Saving recordings isn't available yet — it ships with a pending update." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    // The row was there when we read it and isn't now (deleted, or re-tenanted). Never claim the save.
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ id, recording_saved: saved });
}
