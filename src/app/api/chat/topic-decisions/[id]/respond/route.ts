import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/api/rateLimit";
import { proposeDecisionDialogue } from "@/lib/claude";
import { LlmError } from "@/lib/llm/errors";
import { readyForSystemResponse } from "@/lib/diagnosis/decisionDialogueGate";

/**
 * POST /api/chat/topic-decisions/[id]/respond
 *
 * Generate the System response for an in-thread Decision Dialogue and
 * advance the row to phase='respond'. Reuses the existing
 * proposeDecisionDialogue helper that the off-thread /api/ai/decision-
 * dialogue route also uses — same model, same shape, same brain gate
 * (§3.4 control window).
 *
 * Pre-condition: the row must have non-empty situation, user_diagnosis,
 * and user_proposal. The PATCH route enforces these for phase
 * advancement; this route re-checks them so a direct caller can't slip
 * an empty dialogue past the System.
 */

const FIELDS_SELECT =
  "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at";

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "topic-decision-respond",
    windowMs: 60_000,
    max: 6,
  });
  if (limited) return limited;

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 400 }
    );
  }

  const { id } = await params;
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

  // Per TT.md A21 audit (2026-06-18) MED finding — until this fix,
  // the route relied on RLS alone to gate cross-topic mutations. The
  // PATCH and respond handlers checked auth (signed-in user) but did
  // NOT verify the user is a participant of the parent topic. RLS at
  // the DB layer catches it for company isolation, but an explicit
  // route-layer participant check makes the boundary auditable and
  // returns a clear 403 instead of relying on silent row drop.
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
  if (
    !readyForSystemResponse({
      situation: row.situation,
      userDiagnosis: row.user_diagnosis,
      userProposal: row.user_proposal,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "Situation, diagnosis, and proposal must all be filled before the System will respond.",
      },
      { status: 400 }
    );
  }

  try {
    const r = await proposeDecisionDialogue({
      situation: row.situation,
      userDiagnosis: row.user_diagnosis,
      userProposal: row.user_proposal,
      companyId: row.company_id,
    });
    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text) as {
      engagement: string;
      addedPerspective: string;
      suggestion: { action: string; why: string };
      comparison: string;
    };

    const { data: updated, error: updateErr } = await supabase
      .from("chat_topic_decisions")
      .update({ system_response: parsed, phase: "respond" })
      .eq("id", id)
      .select(FIELDS_SELECT)
      .single();
    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message ?? "Could not save System response." },
        { status: 500 }
      );
    }

    await supabase.from("chat_messages").insert({
      topic_id: row.topic_id,
      company_id: row.company_id,
      author_id: auth.user.id,
      kind: "system",
      body: `System response generated. Engagement → perspective → suggestion now visible in the dialogue card.`,
    });

    await supabase.from("events").insert({
      company_id: row.company_id,
      actor: auth.user.id,
      kind: "decision.system_responded",
      subject: `chat_topic:${row.topic_id}`,
      payload: {
        decision_id: row.id,
        provider: r.provider,
        model: r.model,
        mode: "in_thread",
      },
    });

    return NextResponse.json({ row: updated, provider: r.provider, model: r.model });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind, provider: err.provider },
        { status: err.kind === "rate_limit" ? 429 : err.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
