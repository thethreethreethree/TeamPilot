import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/chat/topic-decisions/[id]/decide
 *
 * Finalize an in-thread Decision Dialogue. Three coupled writes:
 *
 *   1. INSERT into `decisions` (the canonical outcome row used by
 *      /dashboard/decisions Decision Memory) + INSERT into
 *      `decision_dialogues` (the §3.1 append-only dialogue record).
 *      This is the same write-through the off-thread page does so
 *      both surfaces produce identical durability/measurement signals.
 *   2. UPDATE chat_topic_decisions to phase='decided', set
 *      decided_at, chosen_path, chosen_note, and persisted_decision_id.
 *      The table trigger then locks the row.
 *   3. POST a system message into the topic timeline + emit a
 *      `decision.decided` chain event so the readout can attribute
 *      downstream effects (durability, follow-on tasks) to this
 *      moment.
 */

const DecideSchema = z.object({
  chosenPath: z.enum(["user", "system", "hybrid", "defer"]),
  chosenNote: z.string().max(20_000).optional().default(""),
});

const FIELDS_SELECT =
  "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "topic-decision-decide",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const body = await readBody(req, DecideSchema);
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
  if (row.phase === "decided") {
    return NextResponse.json(
      { error: "This dialogue is already decided." },
      { status: 409 }
    );
  }
  if (!row.system_response) {
    return NextResponse.json(
      {
        error:
          "Cannot decide before the System has responded. Run the System response phase first.",
      },
      { status: 400 }
    );
  }

  // Compose title from the user's proposal, mirroring the off-thread
  // path's behavior so Decision Memory shows in-thread decisions with
  // the same title shape.
  const proposalFirstLine = (row.user_proposal ?? "").split("\n")[0] ?? "Decision";
  const title = proposalFirstLine.slice(0, 80) || "Decision";
  const outcome =
    body.chosenPath === "defer"
      ? "Deferred — understanding not yet earned"
      : body.chosenNote ||
        (body.chosenPath === "system"
          ? (row.system_response as { suggestion?: { action?: string } })
              .suggestion?.action ?? ""
          : row.user_proposal ?? "");

  const { data: decision, error: decisionErr } = await supabase
    .from("decisions")
    .insert({
      company_id: row.company_id,
      title,
      situation: row.situation,
      outcome,
      execution_status:
        body.chosenPath === "defer" ? "Deferred" : "In Progress",
      options: row.system_response,
    })
    .select("id")
    .single();
  if (decisionErr || !decision) {
    return NextResponse.json(
      { error: decisionErr?.message ?? "Could not persist decision." },
      { status: 500 }
    );
  }

  const systemResponse = row.system_response as {
    engagement?: string;
    addedPerspective?: string;
    suggestion?: { action?: string; why?: string };
    comparison?: string;
  };
  const { error: dialogueErr } = await supabase
    .from("decision_dialogues")
    .insert({
      company_id: row.company_id,
      decision_id: decision.id,
      situation: row.situation ?? "",
      user_diagnosis: row.user_diagnosis ?? "",
      user_proposal: row.user_proposal ?? "",
      system_engagement: systemResponse.engagement ?? null,
      system_added_perspective: systemResponse.addedPerspective ?? null,
      system_suggestion_action: systemResponse.suggestion?.action ?? null,
      system_suggestion_why: systemResponse.suggestion?.why ?? null,
      system_comparison: systemResponse.comparison ?? null,
      chosen_path: body.chosenPath,
      chosen_note: body.chosenNote || null,
      created_by: auth.user.id,
      decided_at: new Date().toISOString(),
    });
  if (dialogueErr) {
    return NextResponse.json(
      { error: dialogueErr.message },
      { status: 500 }
    );
  }

  const decidedAt = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("chat_topic_decisions")
    .update({
      phase: "decided",
      chosen_path: body.chosenPath,
      chosen_note: body.chosenNote || null,
      decided_at: decidedAt,
      persisted_decision_id: decision.id,
    })
    .eq("id", id)
    .select(FIELDS_SELECT)
    .single();
  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not finalize dialogue." },
      { status: 500 }
    );
  }

  const pathLabel: Record<typeof body.chosenPath & string, string> = {
    user: "Going with my proposal",
    system: "Going with the System's suggestion",
    hybrid: "Hybrid",
    defer: "Deferred — understanding not yet earned",
  };
  await supabase.from("chat_messages").insert({
    topic_id: row.topic_id,
    company_id: row.company_id,
    author_id: auth.user.id,
    kind: "system",
    body: `Decision recorded: ${pathLabel[body.chosenPath]}.${
      body.chosenNote ? `\n\n${body.chosenNote}` : ""
    }`,
  });

  await supabase.from("events").insert({
    company_id: row.company_id,
    actor: auth.user.id,
    kind: "decision.decided",
    subject: `chat_topic:${row.topic_id}`,
    payload: {
      decision_id: row.id,
      persisted_decision_id: decision.id,
      chosen_path: body.chosenPath,
      mode: "in_thread",
    },
  });

  return NextResponse.json({ row: updated });
}
