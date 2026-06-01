import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/decisions
 * Persists a Decision Dialogue + its outcome row. The full dialogue is stored so the
 * WHY survives past the moment of decision (CLAUDE.md §2, §3.5).
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

  const body = await req.json();
  const {
    situation,
    userDiagnosis,
    userProposal,
    systemResponse,
    chosenPath,
    chosenNote,
    title,
    outcome,
  } = body;

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
    return NextResponse.json({ error: decisionErr.message }, { status: 500 });
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
      system_engagement: systemResponse?.engagement,
      system_added_perspective: systemResponse?.addedPerspective,
      system_suggestion_action: systemResponse?.suggestion?.action,
      system_suggestion_why: systemResponse?.suggestion?.why,
      system_comparison: systemResponse?.comparison,
      chosen_path: chosenPath,
      chosen_note: chosenNote ?? null,
      created_by: auth.user.id,
      decided_at: new Date().toISOString(),
    });
  if (dialogueErr) {
    return NextResponse.json({ error: dialogueErr.message }, { status: 500 });
  }

  return NextResponse.json({ decisionId: decision.id });
}
