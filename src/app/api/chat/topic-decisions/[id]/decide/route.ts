import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/chat/topic-decisions/[id]/decide
 *
 * Finalize an in-thread Decision Dialogue.
 *
 * §1.7 audit M1 fix (2026-06-12): this route used to perform FIVE
 * sequential Supabase writes (decisions / decision_dialogues /
 * chat_topic_decisions / chat_messages / events) with no transaction
 * boundary. Any failure between writes 2–5 left the database in a
 * partial state — the dialogue could be persisted but the
 * chat_topic_decisions row still in phase='decide', or the system
 * message could land but the §3.1 chain event drop, so the
 * Brain readout under-counted decisions.
 *
 * Migration 0027 introduced `decide_chat_topic_decision()` — a
 * SECURITY INVOKER plpgsql function that performs all five writes
 * inside one implicit transaction. RLS still applies per write
 * (no privilege elevation). If any write fails, every write rolls
 * back. The route is now a single rpc() call plus the read-back.
 *
 * What this route still owns: auth check, rate limiting, input
 * shape validation, error→HTTP-status mapping. The DB function
 * owns the write-through invariant.
 */

const DecideSchema = z.object({
  chosenPath: z.enum(["user", "system", "hybrid", "defer"]),
  chosenNote: z.string().max(20_000).optional().default(""),
});

type DecidedRow = {
  id: string;
  company_id: string;
  topic_id: string;
  opened_by: string;
  opened_at: string;
  phase: string;
  situation: string | null;
  user_diagnosis: string | null;
  user_proposal: string | null;
  system_response: unknown;
  chosen_path: string | null;
  chosen_note: string | null;
  decided_at: string | null;
  persisted_decision_id: string | null;
  updated_at: string;
};

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

  const { data, error } = await supabase.rpc("decide_chat_topic_decision", {
    p_topic_decision_id: id,
    p_chosen_path: body.chosenPath,
    p_chosen_note: body.chosenNote ?? "",
  });

  if (error) {
    // Map the function's typed errcodes to HTTP statuses. The codes
    // are set explicitly in the SQL function so the route's response
    // shape stays identical to the pre-M1 sequential-write version
    // (test harness + UI both still consume the same error.message
    // string contract).
    const msg = error.message ?? "Could not finalize dialogue.";
    if (msg.includes("Not authenticated")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("Dialogue not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("Dialogue already decided")) {
      return NextResponse.json(
        { error: "This dialogue is already decided." },
        { status: 409 }
      );
    }
    if (msg.includes("Cannot decide before the System has responded")) {
      return NextResponse.json(
        {
          error:
            "Cannot decide before the System has responded. Run the System response phase first.",
        },
        { status: 400 }
      );
    }
    if (msg.includes("Invalid chosen_path")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const row = (data as DecidedRow | null) ?? null;
  if (!row) {
    return NextResponse.json(
      { error: "Decide RPC returned no row." },
      { status: 500 }
    );
  }
  return NextResponse.json({ row });
}
