import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { DecisionCreateSchema } from "@/lib/api/validate";

/**
 * POST /api/decisions
 * Persists a Decision Dialogue + its outcome row. The full dialogue is stored so the
 * WHY survives past the moment of decision (§2, §3.5).
 *
 * Body: {
 *   situation, userDiagnosis, userProposal,
 *   systemResponse: { engagement, addedPerspective, suggestion: { action, why }, comparison },
 *   chosenPath: 'user'|'system'|'hybrid'|'defer',
 *   chosenNote?: string,
 *   title: string,
 *   outcome?: string,
 * }
 */
export async function POST(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured. Dialogue not persisted." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const companyId = profile?.company_id;
  if (!companyId) {
    return NextResponse.json(
      { error: "Complete onboarding before recording decisions." },
      { status: 400 }
    );
  }

  const parsed = DecisionCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid decision fields." },
      { status: 400 }
    );
  }
  const {
    situation,
    userDiagnosis,
    userProposal,
    systemResponse,
    chosenPath,
    chosenNote,
    title,
    outcome,
  } = parsed.data;

  // systemResponse is validated as a bounded object (guards against an oversized
  // jsonb blob); its inner shape is the LLM dialogue response. Type it locally for
  // the per-column extraction below — the values land in text / jsonb columns.
  const sr = (systemResponse ?? null) as {
    engagement?: unknown;
    addedPerspective?: unknown;
    suggestion?: { action?: unknown; why?: unknown };
    comparison?: unknown;
  } | null;

  // Insert the outcome row first (decisions table from 0001 schema).
  const { data: decision, error: decisionErr } = await supabase
    .from("decisions")
    .insert({
      company_id: companyId,
      title: title ?? "Untitled decision",
      situation,
      outcome: outcome ?? null,
      execution_status: chosenPath === "defer" ? "Deferred" : "In Progress",
      options: systemResponse ?? null,
    })
    .select("id")
    .single();
  if (decisionErr) {
    console.error("[decisions] failed to save decision:", decisionErr);
    return NextResponse.json({ error: "Couldn't save the decision." }, { status: 500 });
  }

  // Insert the dialogue record linked to the decision.
  const { error: dialogueErr } = await supabase
    .from("decision_dialogues")
    .insert({
      company_id: companyId,
      decision_id: decision.id,
      situation,
      user_diagnosis: userDiagnosis,
      user_proposal: userProposal,
      system_engagement: sr?.engagement,
      system_added_perspective: sr?.addedPerspective,
      system_suggestion_action: sr?.suggestion?.action,
      system_suggestion_why: sr?.suggestion?.why,
      system_comparison: sr?.comparison,
      chosen_path: chosenPath,
      chosen_note: chosenNote ?? null,
      created_by: auth.user.id,
      decided_at: new Date().toISOString(),
    });
  if (dialogueErr) {
    // The decision row already landed. Without cleanup, the user
    // sees a 500 and (if they retry) gets a NEW decision row,
    // leaving the orphaned first row behind. Roll the decision
    // back so the user's retry produces exactly one row.
    // (Supabase/PostgREST has no real transaction here — best-
    // effort delete is the pragmatic fix until we wrap in an
    // RPC.)
    await supabase.from("decisions").delete().eq("id", decision.id);
    console.error("[decisions] dialogue capture failed; rolled back the decision:", dialogueErr);
    return NextResponse.json(
      {
        error:
          "Decision saved but dialogue capture failed. The partial decision has been rolled back — please try again.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ decisionId: decision.id });
}
