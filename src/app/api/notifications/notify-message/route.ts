import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { sendPushToUsers, type PushPayload } from "@/lib/notifications/sender";

/**
 * POST /api/notifications/notify-message
 *
 * Team Chat PWA — Phase 2.2 fan-out endpoint.
 *
 * The client fires this fire-and-forget after a chat message lands.
 * The route:
 *   1. Verifies the caller authored the message (anti-spoof — you
 *      can't trigger notifications for messages you didn't send)
 *   2. Looks up the topic's participants
 *   3. Excludes the sender + anyone without push subscriptions
 *   4. Sends a push payload to the rest
 *
 * Failures are swallowed so a notification problem never makes the
 * message-send feel broken. The message has already landed by the
 * time this route is called.
 *
 * Rate limit: 60/min/user — each message triggers one call, and
 * realistic chat throughput stays well under this.
 */

const NotifyMessageSchema = z.object({
  topicId: z.string().uuid(),
  messageId: z.string().uuid(),
  /** Truncated body for the notification preview. Client sends ≤120
   *  chars; we cap server-side anyway. */
  bodyPreview: z.string().min(1).max(200),
  authorName: z.string().min(1).max(200),
  topicTitle: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "notifications-notify-message",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  const body = await readBody(req, NotifyMessageSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Anti-spoof: only the message's actual author can trigger
  // notifications for that message. RLS would block reading a
  // message the user doesn't have access to, so an unauthorized
  // caller will get null here.
  const { data: msg } = await supabase
    .from("chat_messages")
    .select("author_id, company_id, topic_id")
    .eq("id", body.messageId)
    .maybeSingle();
  if (!msg || msg.author_id !== auth.user.id || msg.topic_id !== body.topicId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Fetch topic participants — every member of the company can in
  // principle see the topic, but we only notify users who've actively
  // engaged (sent a message OR joined explicitly). This keeps push
  // volume sane.
  //
  // The simplest "engagement" signal: anyone who's sent at least one
  // non-system message in this topic recently. We grab the distinct
  // author_id set from the last N messages.
  const admin = createAdminClient();
  const { data: recentAuthors } = await admin
    .from("chat_messages")
    .select("author_id")
    .eq("topic_id", body.topicId)
    .eq("company_id", msg.company_id)
    .eq("kind", "message")
    .not("author_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!recentAuthors || recentAuthors.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  const recipientIds = Array.from(
    new Set(
      recentAuthors
        .map((r) => r.author_id as string | null)
        .filter((id): id is string => !!id && id !== auth.user!.id)
    )
  );

  if (recipientIds.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  const payload: PushPayload = {
    title: `${body.authorName} in ${body.topicTitle}`,
    body: body.bodyPreview.slice(0, 120),
    url: `/dashboard/chats/${body.topicId}`,
    // Same tag for all messages in a topic — multiple new messages
    // collapse into a single notification per device.
    tag: `topic:${body.topicId}`,
  };

  // Fire fan-out, but don't block on it from the response side. The
  // user already saw their own message land; this is purely
  // server-to-recipient.
  const result = await sendPushToUsers({ userIds: recipientIds, payload });

  return NextResponse.json({
    notified: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  });
}
