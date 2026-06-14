import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/chat/topic-decisions
 *
 * Open a new in-thread Decision Dialogue against a chat topic. Only
 * topic admins can open one — the dialogue is the structured surface
 * the admin uses to drive the room through the §3.3 guide-don't-
 * overtake discipline.
 *
 * Side effects:
 *   - inserts chat_topic_decisions row at phase='situation'
 *   - posts a system-kind message into the topic so the conversation
 *     timeline records the moment the dialogue opened
 *   - emits a `decision.opened` event onto the §3.1 chain
 */

const OpenSchema = z.object({
  topicId: z.string().uuid(),
  initialSituation: z.string().max(20_000).optional().default(""),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "topic-decision-open",
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

  const body = await readBody(req, OpenSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Topic existence + admin gate. RLS would let any company member
  // INSERT (we kept that loose so collaborative open-by-admin works
  // even if you're not the topic creator), but at the API layer we
  // require the caller to be a topic admin — opening a decision
  // dialogue is a §3.3 act of room leadership.
  const { data: topic, error: topicErr } = await supabase
    .from("chat_topics")
    .select("id, company_id, status")
    .eq("id", body.topicId)
    .maybeSingle();
  if (topicErr || !topic) {
    return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  }
  if (topic.status === "closed") {
    return NextResponse.json(
      { error: "This topic is closed — open a new topic to run a dialogue." },
      { status: 400 }
    );
  }

  const { data: participant } = await supabase
    .from("chat_participants")
    .select("role, left_at")
    .eq("topic_id", body.topicId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!participant || participant.left_at) {
    return NextResponse.json(
      { error: "You must be an active participant of this topic." },
      { status: 403 }
    );
  }
  // Admin gate — accept EITHER per-topic admin OR company-level
  // admin (CEO / COO / admin). Matches the client-side iAmAdmin
  // logic in the chat detail page so John (company CEO) can open a
  // dialogue on any topic in his company without needing an
  // explicit chat_participants.role = 'admin' flip. Per-topic admin
  // still works as the finer-grained promotion path for non-
  // company-admins in a specific topic.
  if (participant.role !== "admin") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    const isCompanyAdmin =
      profile?.role === "CEO" ||
      profile?.role === "COO" ||
      profile?.role === "admin";
    if (!isCompanyAdmin) {
      return NextResponse.json(
        { error: "Only topic admins or company admins can open a Decision Dialogue." },
        { status: 403 }
      );
    }
  }

  // Refuse to open a second dialogue while one is already in progress.
  // The partial unique index would block at the DB layer; we check
  // here to return a 409 with a useful message instead of a generic
  // RLS / constraint error.
  const { data: existing } = await supabase
    .from("chat_topic_decisions")
    .select("id, phase")
    .eq("topic_id", body.topicId)
    .neq("phase", "decided")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          "A Decision Dialogue is already open on this topic. Continue it or finalize before starting another.",
      },
      { status: 409 }
    );
  }

  const { data: row, error: insertErr } = await supabase
    .from("chat_topic_decisions")
    .insert({
      company_id: topic.company_id,
      topic_id: body.topicId,
      opened_by: auth.user.id,
      phase: "situation",
      situation: body.initialSituation ?? "",
    })
    .select(
      "id, company_id, topic_id, opened_by, opened_at, phase, situation, user_diagnosis, user_proposal, system_response, chosen_path, chosen_note, decided_at, persisted_decision_id, updated_at"
    )
    .single();
  if (insertErr || !row) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not open dialogue." },
      { status: 500 }
    );
  }

  // Timeline marker: append a system message so anyone reading the
  // thread later sees exactly when the dialogue opened, by whom.
  await supabase.from("chat_messages").insert({
    topic_id: body.topicId,
    company_id: topic.company_id,
    author_id: auth.user.id,
    kind: "system",
    body: "Decision Dialogue opened. The four-phase flow is now active above the composer.",
  });

  // §3.1 chain event — the readout uses these to attribute consequences
  // (durability, follow-on tasks) to the moment the dialogue started.
  await supabase.from("events").insert({
    company_id: topic.company_id,
    actor: auth.user.id,
    kind: "decision.opened",
    subject: `chat_topic:${body.topicId}`,
    payload: { decision_id: row.id, mode: "in_thread" },
  });

  return NextResponse.json({ row });
}
