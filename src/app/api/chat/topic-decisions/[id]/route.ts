import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * PATCH /api/chat/topic-decisions/[id]
 *
 * Save in-progress draft state and/or advance the phase. Used while
 * the user is typing through Situation → Your read, and when they
 * click Continue between phases.
 *
 * Advancement rules (enforced server-side, not just in the UI):
 *   - situation → elicit:   requires situation to be non-empty
 *   - elicit → respond:     not advanced here; that transition is
 *                           owned by /respond which calls the AI
 *   - respond → decide:     allowed once system_response exists
 *
 * Once phase='decided' no patches are accepted; the row is frozen by
 * the table-level trigger.
 */

const PatchSchema = z.object({
  situation: z.string().max(20_000).optional(),
  userDiagnosis: z.string().max(20_000).optional(),
  userProposal: z.string().max(20_000).optional(),
  phase: z.enum(["situation", "elicit", "respond", "decide"]).optional(),
});

const FIELDS_SELECT =
  "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "topic-decision-save",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("chat_topic_decisions")
    .select(FIELDS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "Dialogue not found." }, { status: 404 });
  }

  // Per TT.md A21 audit (2026-06-18) MED finding — explicit topic-
  // participant gate. RLS catches it at the DB layer, but route-layer
  // check returns a clear 403 and makes the auth boundary auditable
  // instead of silent.
  const { data: participation } = await supabase
    .from("chat_participants")
    .select("user_id")
    .eq("topic_id", row.topic_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!participation) {
    return NextResponse.json(
      {
        error:
          "Not a participant of this topic. Decision dialogues are scoped to topic participants.",
      },
      { status: 403 }
    );
  }

  if (row.phase === "decided") {
    return NextResponse.json(
      { error: "This dialogue is decided and frozen." },
      { status: 409 }
    );
  }

  // Advancement validation. The UI gates the Continue button on the
  // same fields, but a client built to skip the check should still be
  // refused. Re-derive against the patched values, falling back to
  // existing row values for anything the patch didn't touch.
  const next = {
    situation: body.situation ?? row.situation ?? "",
    user_diagnosis: body.userDiagnosis ?? row.user_diagnosis ?? "",
    user_proposal: body.userProposal ?? row.user_proposal ?? "",
  };
  const targetPhase = body.phase ?? row.phase;

  if (targetPhase === "elicit" && !next.situation.trim()) {
    return NextResponse.json(
      { error: "Cannot advance to 'Your read' without a Situation." },
      { status: 400 }
    );
  }
  if (
    targetPhase === "respond" &&
    (!next.user_diagnosis.trim() || !next.user_proposal.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "Cannot advance to 'System response' without both diagnosis and proposal.",
      },
      { status: 400 }
    );
  }
  if (targetPhase === "decide" && !row.system_response) {
    return NextResponse.json(
      {
        error:
          "Cannot advance to 'Decide' until the System response has been generated.",
      },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.situation !== undefined) patch.situation = body.situation;
  if (body.userDiagnosis !== undefined)
    patch.user_diagnosis = body.userDiagnosis;
  if (body.userProposal !== undefined) patch.user_proposal = body.userProposal;
  if (body.phase !== undefined) patch.phase = body.phase;

  const { data: updated, error: updateErr } = await supabase
    .from("chat_topic_decisions")
    .update(patch)
    .eq("id", id)
    .select(FIELDS_SELECT)
    .single();
  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Save failed." },
      { status: 500 }
    );
  }

  // Phase advance gets a timeline marker + chain event. Pure draft
  // saves (no phase change) don't — otherwise every keystroke would
  // flood the thread and the chain.
  if (body.phase && body.phase !== row.phase) {
    const labels: Record<typeof body.phase & string, string> = {
      situation: "Situation phase",
      elicit: "Your read phase",
      respond: "System response phase",
      decide: "Decide phase",
    };
    await supabase.from("chat_messages").insert({
      topic_id: row.topic_id,
      company_id: row.company_id,
      author_id: auth.user.id,
      kind: "system",
      body: `Decision Dialogue advanced to: ${labels[body.phase]}`,
    });
    await supabase.from("events").insert({
      company_id: row.company_id,
      actor: auth.user.id,
      kind: "decision.phase_entered",
      subject: `chat_topic:${row.topic_id}`,
      payload: {
        decision_id: row.id,
        from_phase: row.phase,
        to_phase: body.phase,
        mode: "in_thread",
      },
    });
  }

  return NextResponse.json({ row: updated });
}
