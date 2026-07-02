import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/chat/topics/[id]/lock (migration 0071)
 *
 * Lock / unlock a small topic. The CREATOR can lock a chat with 2 OR FEWER
 * active participants (including a solo topic), no admin approval (founder
 * 2026-07-03, widening 0071's exactly-2 rule). 3+ participants require admin
 * permission — a separate, not-yet-built step. When locked, the topic + its
 * context are visible only to its members (RLS) — even admins are excluded —
 * and no one else can join. The lock restricts ACCESS only; it deletes nothing
 * (§3.1). The System still reads it (service-role bypasses RLS) — disclosed in
 * the UI.
 */

const Body = z.object({ locked: z.boolean() });

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "chat-topic-lock",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Only the creator can lock.
  const { data: topic } = await admin
    .from("chat_topics")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!topic) {
    return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  }
  if (topic.created_by !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the person who created this chat can lock it." },
      { status: 403 }
    );
  }

  // Creator lock is for a chat with 2 OR FEWER active participants (incl. a
  // solo topic). 3+ participants need admin permission — a separate, not-yet-
  // built step — so reject creator locks there for now (founder 2026-07-03).
  const { count } = await admin
    .from("chat_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("topic_id", id)
    .is("left_at", null);
  if ((count ?? 0) > 2) {
    return NextResponse.json(
      {
        error:
          "Locking a chat with 3 or more people needs admin permission.",
      },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("chat_topics")
    .update({
      locked: body.locked,
      locked_at: body.locked ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't update the lock." },
      { status: 500 }
    );
  }

  return NextResponse.json({ locked: body.locked });
}
