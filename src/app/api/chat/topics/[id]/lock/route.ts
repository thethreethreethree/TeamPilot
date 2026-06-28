import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/chat/topics/[id]/lock (migration 0071)
 *
 * Lock / unlock a 2-person topic. Only the CREATOR can do it, and only
 * on a topic with exactly 2 active participants (founder spec). When
 * locked, the topic + its context are visible only to the two
 * participants (RLS) — even admins are excluded — and no one else can
 * join. The lock restricts ACCESS only; it deletes nothing (§3.1). The
 * System still reads it (service-role bypasses RLS) — disclosed in the UI.
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

  // Only a 2-person chat (exactly 2 ACTIVE participants).
  const { count } = await admin
    .from("chat_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("topic_id", id)
    .is("left_at", null);
  if ((count ?? 0) !== 2) {
    return NextResponse.json(
      {
        error:
          "Locking is only available for a chat with exactly two people.",
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
